(function () {
  var STATE_DB_CANDIDATES = [
    "F:/AIAgentData/Data/AppData/Roaming/Cursor/User/globalStorage/state.vscdb",
    "~/AppData/Roaming/Cursor/User/globalStorage/state.vscdb",
    "~/Library/Application Support/Cursor/User/globalStorage/state.vscdb",
  ]
  var APP_CANDIDATES = [
    "~/AppData/Local/Programs/Grok Bot/Grok Bot.exe",
  ]
  var USAGE_URL = "https://api2.cursor.sh/aiserver.v1.DashboardService/GetSandUsageStatus"
  var WEEK_MS = 7 * 24 * 60 * 60 * 1000

  function fail(message) {
    throw message
  }

  function appInstalled(ctx) {
    for (var i = 0; i < APP_CANDIDATES.length; i++) {
      try {
        if (ctx.host.fs.exists(APP_CANDIDATES[i])) return true
      } catch (e) {
        ctx.host.log.warn("grok-bot app check failed")
      }
    }
    return false
  }

  function readSqliteToken(ctx) {
    var sql = "SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken' LIMIT 1;"
    for (var i = 0; i < STATE_DB_CANDIDATES.length; i++) {
      try {
        var json = ctx.host.sqlite.query(STATE_DB_CANDIDATES[i], sql)
        var rows = ctx.util.tryParseJson(json)
        if (Array.isArray(rows) && rows.length > 0 && rows[0].value) return rows[0].value
      } catch (e) {
        ctx.host.log.warn("grok-bot auth read failed")
      }
    }
    return null
  }

  function readKeychainToken(ctx) {
    if (!ctx.host.keychain || typeof ctx.host.keychain.readGenericPassword !== "function") return null
    try {
      var value = ctx.host.keychain.readGenericPassword("cursor-access-token")
      if (typeof value !== "string") return null
      var trimmed = value.trim()
      return trimmed || null
    } catch (e) {
      ctx.host.log.warn("grok-bot keychain read failed")
      return null
    }
  }

  function readNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (typeof value === "string" && value.trim() !== "") {
      var n = Number(value.trim())
      return Number.isFinite(n) ? n : null
    }
    return null
  }

  function postUsage(ctx, token) {
    return ctx.util.request({
      method: "POST",
      url: USAGE_URL,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
      },
      bodyText: "{}",
      timeoutMs: 10000,
    })
  }

  function lineFromUsage(ctx, usage) {
    if (!usage || typeof usage !== "object") return null
    if (usage.usesPooledEnterpriseAllowance === true ||
      usage.hasNonZeroIncludedLimit === false ||
      usage.includedLimitZero === true) {
      return { kind: "none" }
    }
    var percent = readNumber(usage.usagePercent)
    if (percent === null || percent < 0) return null
    var resetMs = typeof usage.nextResetTimestampUtc === "string"
      ? ctx.util.parseDateMs(usage.nextResetTimestampUtc)
      : null
    var startMs = typeof usage.currentPeriodStart === "string"
      ? ctx.util.parseDateMs(usage.currentPeriodStart)
      : null
    return {
      kind: "progress",
      line: ctx.line.progress({
        label: "每周",
        used: Math.min(100, percent),
        limit: 100,
        format: { kind: "percent" },
        resetsAt: resetMs !== null ? ctx.util.toIso(resetMs) : null,
        periodDurationMs: startMs !== null && resetMs !== null && resetMs > startMs ? resetMs - startMs : WEEK_MS,
      }),
    }
  }

  globalThis.__openusage_plugin = {
    id: "grok-bot",
    probe: function (ctx) {
      if (!appInstalled(ctx)) fail("读不到额度。")
      var tokens = []
      var sqliteToken = readSqliteToken(ctx)
      var keychainToken = readKeychainToken(ctx)
      if (sqliteToken) tokens.push(sqliteToken)
      if (keychainToken && keychainToken !== sqliteToken) tokens.push(keychainToken)
      if (tokens.length === 0) fail("读不到额度。")
      for (var i = 0; i < tokens.length; i++) {
        var resp
        try {
          resp = postUsage(ctx, tokens[i])
        } catch (e) {
          ctx.host.log.warn("grok-bot request failed")
          continue
        }
        if (!resp || resp.status < 200 || resp.status >= 300) continue
        var parsed = lineFromUsage(ctx, ctx.util.tryParseJson(resp.bodyText))
        if (!parsed) continue
        if (parsed.kind === "none") {
          return { lines: [ctx.line.text({ label: "每周", value: "没有可用额度" })] }
        }
        return { lines: [parsed.line] }
      }
      fail("读不到额度。")
    },
  }
})()
