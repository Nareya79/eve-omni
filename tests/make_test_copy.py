#!/usr/bin/env python3
# Injects window.__test = {...} into a temp copy of eve-zentrale.html, right before the
# closing `refreshStation();\n})();` marker at the end of the main IIFE, so jsdom-based tests
# can reach internal functions/closures without a real EVE SSO login or a real browser.
# NEVER commit this hook into the shipped eve-zentrale.html - source copy stays untouched.
import sys

SRC = "/home/claude/EVECore.html"
MARKER = "  refreshStation();\n  setTimeout(openTradingTab, 400);\n})();"

HOOK = """  window.__test = {
    flattenShips: flattenShips,
    resolveSkillTypeIds: resolveSkillTypeIds,
    getShipStats: getShipStats,
    computeAlignSeconds: computeAlignSeconds,
    loadAllTokens: loadAllTokens,
    getSelectedCharIds: getSelectedCharIds,
    foldToOther: (typeof foldToOther !== "undefined") ? foldToOther : null,
    buildPieDataByCharacter: (typeof buildPieDataByCharacter !== "undefined") ? buildPieDataByCharacter : null,
    computeWalletStats: (typeof computeWalletStats !== "undefined") ? computeWalletStats : null,
    renderPieChart: (typeof renderPieChart !== "undefined") ? renderPieChart : null,
    renderNetWorth: renderNetWorth,
    journalTypeLabel: (typeof journalTypeLabel !== "undefined") ? journalTypeLabel : null,
    setWalletJournalCache: function(v){ walletJournalCache = v; },
    renderWalletJournal: renderWalletJournal,
    renderOrdersActive: (typeof renderOrdersActive !== "undefined") ? renderOrdersActive : null,
    renderOrdersHistory: (typeof renderOrdersHistory !== "undefined") ? renderOrdersHistory : null,
    renderContractsList: (typeof renderContractsList !== "undefined") ? renderContractsList : null,
    getCharacterCorpId: (typeof getCharacterCorpId !== "undefined") ? getCharacterCorpId : null,
    getCorporationName: (typeof getCorporationName !== "undefined") ? getCorporationName : null,
    getContractItems: (typeof getContractItems !== "undefined") ? getContractItems : null,
    toggleContractDetail: (typeof toggleContractDetail !== "undefined") ? toggleContractDetail : null,
    renderIndustryJobs: (typeof renderIndustryJobs !== "undefined") ? renderIndustryJobs : null,
    renderMiningLedger: (typeof renderMiningLedger !== "undefined") ? renderMiningLedger : null,
    bfsSystemsInRadius: bfsSystemsInRadius,
    buildReachableStations: buildReachableStations,
    computeTravelSeconds: computeTravelSeconds,
    getSystemInfo: getSystemInfo,
    getStationInfo: getStationInfo,
    getStructureInfo: getStructureInfo,
    resolveSystemByName: resolveSystemByName,
    FITTING_TEMPLATES: FITTING_TEMPLATES,
    runHaulingSearch: runHaulingSearch,
    getHlDestinations: function(){ return hlDestinations; },
    runShipRecommendation: runShipRecommendation,
    buildAssetGroups: buildAssetGroups,
    resolveLocationName: resolveLocationName,
    runSellScan: runSellScan,
    getSsResultRows: function(){ return ssResultRows; },
    getSsAssetsByLoc: function(){ return ssAssetsByLoc; },
    SHIPS: SHIPS,
    loadOwnedShipNames: (typeof loadOwnedShipNames !== "undefined") ? loadOwnedShipNames : null,
    saveOwnedShipNames: (typeof saveOwnedShipNames !== "undefined") ? saveOwnedShipNames : null,
    renderShipChecklist: (typeof renderShipChecklist !== "undefined") ? renderShipChecklist : null,
    autoDetectOwnedShips: (typeof autoDetectOwnedShips !== "undefined") ? autoDetectOwnedShips : null,
    getModuleCargoMultiplier: (typeof getModuleCargoMultiplier !== "undefined") ? getModuleCargoMultiplier : null,
    combineCargoMultipliers: (typeof combineCargoMultipliers !== "undefined") ? combineCargoMultipliers : null,
    computeBestOwnCargo: (typeof computeBestOwnCargo !== "undefined") ? computeBestOwnCargo : null,
    formatIntGroups: (typeof formatIntGroups !== "undefined") ? formatIntGroups : null,
    parseGroupedInt: (typeof parseGroupedInt !== "undefined") ? parseGroupedInt : null,
    wireGroupedNumberInput: (typeof wireGroupedNumberInput !== "undefined") ? wireGroupedNumberInput : null,
    buildSettingsSyncBat: (typeof buildSettingsSyncBat !== "undefined") ? buildSettingsSyncBat : null,
    renderSettingsSyncPanel: (typeof renderSettingsSyncPanel !== "undefined") ? renderSettingsSyncPanel : null,
    buildDotlanJumpUrl: (typeof buildDotlanJumpUrl !== "undefined") ? buildDotlanJumpUrl : null,
    findSystems: (typeof findSystems !== "undefined") ? findSystems : null,
    loadSystemNames: (typeof loadSystemNames !== "undefined") ? loadSystemNames : null,
    importTradeSkills: (typeof importTradeSkills !== "undefined") ? importTradeSkills : null,
    buildDotlanRouteUrl: (typeof buildDotlanRouteUrl !== "undefined") ? buildDotlanRouteUrl : null,
    analyzeQueue: (typeof analyzeQueue !== "undefined") ? analyzeQueue : null,
    refreshSkills: (typeof refreshSkills !== "undefined") ? refreshSkills : null,
    updateSkillCountdowns: (typeof updateSkillCountdowns !== "undefined") ? updateSkillCountdowns : null,
    parseDotlanRoute: (typeof parseDotlanRoute !== "undefined") ? parseDotlanRoute : null,
    navHandlePaste: (typeof navHandlePaste !== "undefined") ? navHandlePaste : null,
    haulerChars: (typeof haulerChars !== "undefined") ? haulerChars : null,
    jumpSkillCheck: jumpSkillCheck,
    applyUi: (typeof applyUi !== "undefined") ? applyUi : null,
    tscTick: tscTick, tscAbove: tscAbove, tscBelow: tscBelow, tscFees: tscFees, trEvaluate: trEvaluate, trRebuy: trRebuy, trRebuyHtml: trRebuyHtml, trSyncBA: trSync, trAbortHtml: trAbortHtml, trPendGet: trPendGet, trSrcTip: trSrcTip, tscHistStats: tscHistStats,
    tscHistRef: tscHistRef, tscGroupBook: tscGroupBook, tscPreselect: tscPreselect, tscAnalyzeType: tscAnalyzeType,
    tscPlan: tscPlan, tscCheckOrder: tscCheckOrder, tscCopyPrice: tscCopyPrice, tscNiceQty: tscNiceQty,
    tscUnitProfit: tscUnitProfit, runTradeScan: runTradeScan, tscReadCfg: tscReadCfg, tscShowView: tscShowView,
    getTscRows: function(){ return tscRows; }, tscPlanText: tscPlanText,
    pnlCompute: pnlCompute, pnlMerge: pnlMerge, pnlRender: pnlRender, pnlRefresh: pnlRefresh, pnlLoadStore: pnlLoadStore,
    shortNum: shortNum, tscRenderCharSelect: tscRenderCharSelect, openPnlView: openPnlView,
    getVolume: getVolume, esiFetch: esiFetch, isEsiLegacy: function(){ return esiLegacyMode; }, setEsiLegacy: function(v){ esiLegacyMode = !!v; },
    ESI_COMPAT_DATE: ESI_COMPAT_DATE,
    rtSecDisplay: rtSecDisplay, rtSecColor: rtSecColor, rtSecClass: rtSecClass, rtCompute: rtCompute, rtGo: rtGo, rtFetchRoute: rtFetchRoute,
    rtLoad: rtLoad, kmBigSync: kmBigSync, onHostCommand: onHostCommand, rtRouteStats: rtRouteStats, rtStatsText: rtStatsText, rtSysLoad: rtSysLoad, rtLoadKills: rtLoadKills, rtSetPos: rtSetPos,
    rtRouteText: rtRouteText, openEsiRouteTab: openEsiRouteTab,
    dxBuild: dxBuild, dxParse: dxParse, dxApply: dxApply, dxSummary: dxSummary, dxKeys: dxKeys,
    mkBtn: mkBtn, mkChar: mkChar, stDest: stDest, haulRoute: haulRoute, jbMqSync: jbMqSync, getHaulRouteMsg: function(){ return haulRouteMsg; },
    ovSetMode: ovSetMode, ovGetMode: ovGetMode, ovRender: ovRender, ovLoad: ovLoad, ovLook: ovLook, ovSave: ovSave,
    ovCollectAlarms: ovCollectAlarms, ovAfterTradesRefresh: ovAfterTradesRefresh, ovAlarm: ovAlarm, ovLoadWallet: ovLoadWallet, ovFootText: ovFootText, ovAgeSet: ovAgeSet, esiCd: esiCd, esiCdTxt: esiCdTxt, trSync: trSync, trPreBuy: trPreBuy, greedyAllocate2: greedyAllocate, gkLotsJita: gkLotsJita, gkJitaLoop: gkJitaLoop, gkJrefSet: function(t, p, chk){ gkJref[t] = p; if (chk) gkJchk[t] = 1; }, trProgressII: trProgress, trIgnoredII: trIgnored, trRunTagII: trRunTag,
    ovEnsureData: ovEnsureData, ovsRender: ovsRender, hsAccelFromEvent: hsAccelFromEvent, hsAccelText: hsAccelText, hsRender: hsRender,
    onHostCommand: onHostCommand, trRefresh: trRefresh, getTrLive: function(){ return trLive; },
    ckSync: ckSync, ckLoad: ckLoad, ckAdd: ckAdd, ckAction: ckAction, trkRender: trkRender, trkSetKind: trkSetKind,
    ovPublishSatellites: ovPublishSatellites, ovSatAction: ovSatAction, ovMirrorFields: ovMirrorFields, ovRenderViewInto: ovRenderViewInto, esiStampRec: esiStampRec, esiDue: esiDue, esiTaktTxt: esiTaktTxt, esiTaktTick: esiTaktTick, esiStandTxt: esiStandTxt, fmtT: fmtT, ovFootText: ovFootText, ovAgeSet: ovAgeSet, esiCd: esiCd, esiCdTxt: esiCdTxt, trSync: trSync, trPreBuy: trPreBuy, greedyAllocate2: greedyAllocate, gkLotsJita: gkLotsJita, gkJitaLoop: gkJitaLoop, gkJrefSet: function(t, p, chk){ gkJref[t] = p; if (chk) gkJchk[t] = 1; }, trProgressII: trProgress, trIgnoredII: trIgnored, trRunTagII: trRunTag, getOvSatOpen: function(){ return ovSatOpen; },
    setOvData: function(o){ if (o.tscRows){ tscRows = o.tscRows; ovScanTime = Date.now(); } if (o.haul) ovHaulLast = o.haul; if (o.hub) ovHubLast = o.hub; },
    applyMainAlpha: applyMainAlpha,
    tokHasScope: tokHasScope, stdImport: stdImport, stdSourceText: stdSourceText, tscLoadState: tscLoadState,
    ltParse: ltParse, ltCheck: ltCheck, ltState: function(){ return ltState; }, ltFromText: ltFromText, ltRelation: ltRelation, ltZkSummary: ltZkSummary,
    chRefresh: chRefresh, chData: function(){ return chData; }, piAnalyze: piAnalyze, piCheckAlarms: piCheckAlarms, chRender: chRender,
    jbrParse: jbrParse, jbrLoad: jbrLoad, jbrConnections: jbrConnections, rtAutopilot: rtAutopilot, rtLocStart: rtLocStart, rtLocFollowTick: rtLocFollowTick,
    navShow: navShow, rtCtxRoute: rtCtxRoute, kmOmState: kmOmState, kmRtSync: kmRtSync, mpStations: mpStations, mpLoadStore: mpLoadStore, mpSaveStore: mpSaveStore, getTypeName: getTypeName, tscNames: tscNames, hrHealNames: hrHealNames, nameCache: function(){ return nameCache; }, nameFail: function(){ return nameFail; },
    fitBuildEft: fitBuildEft, fitRenderShips: fitRenderShips,
    jbxSetFiles: jbxSetFiles, jbxHostSet: jbxHostSet, jbxPlay: jbxPlay, jbxCommand: jbxCommand, jbxTracks: jbxTracks, jbxLoad: jbxLoad, getJbxAudio: function(){ return jbxAudio; }, jbxGainCalc: jbxGainCalc, waSum: waSum, setKillCache: function(v){ rtKillCache = v; }, waSpan: waSpan, waJrMerge: waJrMerge, waJrCat: waJrCat, waBuckets: waBuckets, waSeries: waSeries, waTypes: waTypes, waOvView: waOvView, waPageRender: waPageRender, doneList: doneList, jbxEqVals: jbxEqVals, ovRenderMusic: ovRenderMusic, jbxDuck: jbxDuck, getJbxIdx: function(){ return jbxIdx; },
    gaOnKill: gaOnKill, gaState: function(){ return gaState; }, rfNameCache: rfNameCache, getOvHubLast: function(){ return ovHubLast; }, isDstKeys: isDstKeys, pickByCargo: pickByCargo, potentialProfit: potentialProfit, gaUpdateNear: gaUpdateNear, gaNormalize: gaNormalize, gaApply: gaApply, ovRenderMap: ovRenderMap, ovMapCmd: ovMapCmd, alRun: alRun, gaTone: gaTone, jbxCleanTitle: jbxCleanTitle, ovAct: ovAct, hlFillItems: hlFillItems, alLoad: alLoad, jbxAutoStart: jbxAutoStart, jbxProbe: jbxProbe, ovRenderMusic: ovRenderMusic, perfHtml: perfHtml, perfSet: function(r){ PERF.last = r; },
    neoNewMark: neoNewMark, neoIsNew: neoIsNew, neoOverlayHtml: neoOverlayHtml, tkNextHtml: tkNextHtml, trEsiHtml: trEsiHtml, ovFootTextAQ: ovFootText, stList: stList, rtRouteCheck: rtRouteCheck, rtCheckHtml: rtCheckHtml, hubKeys: hubKeys, hubStFill: hubStFill, hubRouteAO: hubRoute, stSave: stSave, hubGet: hubGet, hubOrders: hubOrders, tscFeesAO: tscFees, trHubAO: trHub, stAdd: stAdd, stRender: stRender, ovRenderSound: ovRenderSound, sndAction: sndAction, sndCfg: sndCfg, sndCyLast: function(s){ cyLast = s; }, ovFormKeep: ovFormKeep, ovFormWire: ovFormWire, skaToggle: skaToggle, sqAlarmAll: sqAlarmAll, onHostCommand: onHostCommand, neoOverlayAction: neoOverlayAction, cyPvShow: (typeof cyPvShow !== "undefined") ? cyPvShow : null,
    switchTab: switchTab, jbSpEmbed: jbSpEmbed, ltTickers: ltTickers, bfsSystemsInRadius: bfsSystemsInRadius, gkPath: gkPath, glFind: glFind, glDo: glDo, glHtml: glHtml, glPend: glPend, tkChkDo: tkChkDo, gkRouteHit: gkRouteHit, gkSafeF: gkSafeF, gkFleetF: gkFleetF, gkCapF: gkCapF, gkRouteTag: gkRouteTag, hubRoute: hubRoute, buildReachableStations: buildReachableStations, hrAdd: hrAdd, asBuild: asBuild, gkAsShip: gkAsShip, gkRunCalc: gkRunCalc, getAsD: function(){ return asD; }, setAsD: function(D){ asD = D; }, hrProgress: hrProgress, trProgress: trProgress, vcFill: vcFill, vcCheck: vcCheck, greedyAllocate: greedyAllocate, mbVol: mbVol, hrRest: hrRest, ovMirrorFields: ovMirrorFields, ovMirrorApply: ovMirrorApply, hrRefresh2: hrRefresh, ovMultibuy: ovMultibuy, slCopyAll: slCopyAll, mbSplit: mbSplit, vcRun: vcRun, vcCard: vcCard, hrRefresh: hrRefresh, ovAction: function(a){ return ovSatAction("track", a); }, ovSatAct: function(v, a){ return ovSatAction(v, a); }, vcAlarmLast: function(){ return vcLastAlarm; }, tkTimes: tkTimes, trkAll: trkAll, stChimeII: stChime, hrLoad: hrLoad, gkCalc: gkCalc, gkCap: gkCap, gaOnIntel: gaOnIntel, gaIntelParse: gaIntelParse, grLoad: grLoad, sysNamesSet: function(l){ sysNames = l; gaIntelLow = null; }, gkCapTxt2: gkCapTxt, gkOptPill: gkOptPill, gkWhy: gkWhy, gkMk2: gkMk, gkPill2: gkPill, verCmp: verCmp, updCheck: updCheck, updShow: updShow, fitShipA: fitShipA, thLoad: thLoad, thCheck: thCheck, thResHtml: thResHtml, thUsed: thUsed, thListHtml: thListHtml, rtFetchRoute2: rtFetchRoute, thStateSet: function(l){ thState.list = l; thState.t = Date.now(); }, miNeedParse: miNeedParse, miMix: miMix, miTableView: miTableView, miLoad2: miLoad, vcOrdSet: function(k, v){ vcOrd[k] = v; }, miTSet: function(t){ miT = t; }, sysLink: sysLink, rtDangerHtml: rtDangerHtml, whSys: whSys, whType: whType, wmParse: wmParse, wmScout: wmScout, wmLooks: wmLooks, wmFromText: wmFromText, wmAction: wmAction, wmLoad: wmLoad, wmHtml: wmHtml, whTag: whTag, ovRenderWormhole: ovRenderWormhole, whAction: whAction, rtDanger: rtDanger, rtDangerTxt: rtDangerTxt, rtCargoHtml: rtCargoHtml, ckRowHtml2: ckRowHtml, gkFleetPick: gkFleetPick, gkFitTxt: gkFitTxt, gkMk: gkMk, gkCapTxt: gkCapTxt, gkShip: gkShip, gkPill: gkPill, gkLine: gkLine, gkWarnEl: gkWarnEl, gkRun: gkRun, gkRunPill: gkRunPill, lcSave: lcSave, shipFitSet: shipFitSet, tkRes: tkRes, tkChkCalc: tkChkCalc, tkChkApply: tkChkApply, tkAutoDone: tkAutoDone, ctRoute: ctRoute, sysGo: sysGo, inRoleRank: inRoleRank, inLoadBlueprints: inLoadBlueprints, ovMapGo: ovMapGo, ovLoad: ovLoad, ctTitle: ctTitle, mkBtn: mkBtn, hrDetail: hrDetail, hrRefresh: hrRefresh, tkChkHtml: tkChkHtml, tkChkOpen: tkChkOpen, doneList: doneList, trLoad: trLoad, hrUpdate: hrUpdate, troRender: troRender, stChime: stChime, trUpdate: trUpdate, inAction: inAction, inStore: inStore, inView: inView, owView: owView, owAction: owAction, owCat: owCat, owWalletSet: function(w){ ovWallet = w; }, ovBlink: ovBlink, asRender: asRender, insHtml: insHtml, hcAction: hcAction, hcSvg: hcSvg, hcFill: hcFill, hcTxSet: function(v){ hcTxMem = v; }, tscCompetition: tscCompetition, compOwnIds: function(){ return compOwnIds; }, compObserve: compObserve, compLoad: compLoad, compTrade: compTrade, trLiveSet: function(id, v){ trLive[id] = v; }, blLoad: blLoad, blNeo: blNeo, blSetRender: blSetRender, blSetAlarm: function(k){ ovAlarmKeys = k; ovCollectAlarms = function(){ ovAlarmKeys = k; blNeoMain(); return []; }; }, nwSnap: nwSnap, nwWarn: nwWarn, ovRenderWallet: ovRenderWallet, nwLoad: nwLoad, nwSeries: nwSeries, nwChart: nwChart, nwReport: nwReport, nwReportText: nwReportText, nwView: nwView, nwWeek: nwWeek, nwSetNetWorth: function(x){ walletNetWorth = x; }, nwPnlSkip: function(){ nwPnlAsked = true; }, owLoadCorps: owLoadCorps, wvSetView: wvSetView, inActs: inActs,
    snCalc: snCalc, snTop: snTop, snSpFor: snSpFor, snInjSp: snInjSp, snPageRender: snPageRender, tmLoad: tmLoad, neoLoadOrder: neoLoadOrder, tmAction: tmAction, tmTick: tmTick, fmtRemainSec: fmtRemainSec, gankInfo: gankInfo, gankLoad: gankLoad, gankOnRoute: gankOnRoute, gankSetList: gankSetList, rtParseNames: rtParseNames, rtPaste: rtPaste, rtCompute: rtCompute, setSysNames: function(l){ sysNames = l; }, rtRender: rtRender, rtSave: rtSave, tmNextDt: tmNextDt, tmNextAt: tmNextAt, ovRenderTimer: ovRenderTimer, sqSet: function(d){ sqData = d; }, dsParse: dsParse, dsLooks: dsLooks, dsRun: dsRun, dsAction: dsAction, dsFromText: dsFromText, dsLoad: dsLoad, ovRenderDscan: ovRenderDscan, loadSkillUniverse: loadSkillUniverse,
    oxFeed: oxFeed, oxLoad: oxLoad, oxCheck: oxCheck, oxLeft: oxLeft, oxCls: oxCls, oxTrade: oxTrade, oxSumRender: oxSumRender, rfNotify: rfNotify,
    ssoClient: ssoClient, welcomeShow: welcomeShow, loadAllTokens2: loadAllTokens, getValidAccessTokenFor2: getValidAccessTokenFor, exchangeCodeForTokens: exchangeCodeForTokens,
    sortList: sortList, sortGet: sortGet, sortClick: sortClick, sortKeys: sortKeys, sortThen: sortThen, sortBar: sortBar, TRK_SORT: TRK_SORT, renderDestinations: renderDestinations, renderNetWorth: renderNetWorth, trRender: trRender,
    isSuggestShip: isSuggestShip, isShipVal: isShipVal, stCp: stCp, stCpFix: stCpFix, stCell: stCell, t9JumpMin: t9JumpMin, t9Rate: t9Rate, iskhCmp: iskhCmp, hubRefresh: hubRefresh, tkStCls: tkStCls, hrBad: hrBad, vcRed: vcRed, trkOb: trkOb, trkLv: trkLv, vcTog: vcTog, apParse: apParse, coAction: coAction, deckIcons: deckIcons, deckState: deckState, trRefreshOne: trRefreshOne, pnlSaveStore: pnlSaveStore, shortIsk: shortIsk, nwReportRows: nwReportRows, mlRows: mlRows, mlAction: mlAction, miPageRender: miPageRender, fmtNum: fmtNum, jbxTimes: jbxTimes, jbxVizDraw: jbxVizDraw, jbxVizSet: jbxVizSet, wbPage: wbPage, wbEft: wbEft, wbSearch: wbSearch, wbCacheLoad: wbCacheLoad, wbCacheSave: wbCacheSave, wbSaveFit: wbSaveFit, wbSaved: wbSaved, wbAction: wbAction, wbView: wbView, wbGetS: function(){ return wbS; }, wbDetGet: function(id){ return wbDet[id]; }, wbSetWait: function(t){ wbWait = t; }, wbVLoad: wbVLoad, wbIBuild: wbIBuild, wbIUpdate: wbIUpdate, wbIDelete: wbIDelete, wbILoad: wbILoad, wbIGet: function(){ return wbI; }, wbIReset: function(){ wbI = null; wbIState = ""; }, wbIPause: function(ms){ WBI_PAUSE = ms; }, wbIStopNow: function(){ wbIStop = true; }, wbIRunning: function(){ return wbIRun; }, wbErrGet: function(){ return wbErr; }, wbMsgGet: function(){ return wbMsg; }, wbBusyGet: function(){ return wbBusy; }, dxBuildJson: dxBuildJson, wbHostSet: function(h){ EVH = h; }, dxBuildJson: dxBuildJson, WB_PAUSE_SET: function(){}, mnAction: mnAction, mnLoad: mnLoad, mpMiningSys: mpMiningSys, trFromRun: trFromRun, trRunSync: trRunSync, spParse: spParse, spAction: spAction, spLoad: spLoad, spCalc: spCalc, spPageRender: spPageRender, MI_ORES: MI_ORES, miLoad: miLoad, miYield: miYield, miAction: miAction, miRows: miRows, getMiRate: function(){ return miRate; }, getMiSell: function(){ return miSellRes; }, fitStack: fitStack, fitParseEft: fitParseEft, fitFromEft: fitFromEft, fitCalc: fitCalc, asAction: asAction, asPageRender: asPageRender, fcAction: fcAction, coLoad: coLoad, coShown: coShown, coRun: coRun, ovRenderCourier: ovRenderCourier, apIsk: apIsk, apShipsRemember: apShipsRemember, tkAct: tkAct, tkUndo: tkUndo, tkUndoLive: tkUndoLive, tkTrashLoad: tkTrashLoad, tkTrashDo: tkTrashDo, apAction: apAction, apLoad: apLoad, trkLevels: trkLevels, trkKind: trkKind, hrProgress: hrProgress, stColCss: stColCss, trkAll: trkAll, radarCamps: radarCamps, radarDanger: radarDanger, mapZoomCls: mapZoomCls, getOvHub: function(){ return ovHubLast; }, ovViews: function(){ return OV_VIEWS; }, ovTitleIcon: ovTitleIcon, ovShowRoute: ovShowRoute, lcAll: lcAll, jcPlan: jcPlan,
    mbStat: mbStat, mbFind: mbFind, mbOpen: mbOpen, mbAction: mbAction, mbLoad: mbLoad, mbIdxSet: function(x){ mbIdx = x; }, mbCur: function(){ return mbCur; }, mbBookView: mbBookView, mbPageRender: mbPageRender, mbMargin: mbMargin, ovRenderMarket: ovRenderMarket,   // MB
    nwBuyHere: function(){ nwBuyT = 0; nwBuyMine = false; return nwBuyHere(); }, kkwLoad: kkwLoad, nwMine: function(){ return nwBuyMine; }, nwBuyAgain: function(){ nwBuyT = 0; return nwBuyHere(); }, nwPick: function(){ nwBuyMine = true; },   // NW4
    emFetch: emFetch, emAction: emAction, emBodyHtml: emBodyHtml, ovRenderMail: ovRenderMail, emState: function(){ return { heads: emHeads, busy: emBusy, err: emErr, t: emT, open: emOpen, nw: emNew }; }, emUnread: emUnread   // EM
  };
  window.__test.pd = { calc: pdCalc, data: pdData, view: pdView, action: pdAction, load: pdLoad, save: pdSave, inputs: pdInputs, picked: pdPicked, tree: pdTree, plan: pdPlan, buyList: pdBuyList, DEPTH: PD_DEPTH, NODES: PD_NODES, priceUp: pdPriceUp, pageRender: pdPageRender, FAC: PD_FAC, SEC: PD_SEC, px: function(){ return pdPx; }, sci: pdSci, adj: gkAdj, setInD: function(d){ inD = d; }, busy: function(b){ pdBusy = b; }, err: function(){ return pdErr; }, act: pdAct, check: pdCheck, job: pdJob, rf: pdRf, chance: pdInvChance, loc: function(){ return pdLoc; }, calibReset: function(){ pdCalibMem = {}; } };   // PROD, P3
  window.__test.trFind = trFind;   // HO5
  window.__test.setScanRows = function(r){ tscRows = r; ovScanTime = Date.now(); };   // HO5
"""

def main():
    if len(sys.argv) != 2:
        print("usage: make_test_copy.py <output path>")
        sys.exit(1)
    out_path = sys.argv[1]
    with open(SRC, "r", encoding="utf-8") as f:
        html = f.read()
    if MARKER not in html:
        print("MARKER NOT FOUND - aborting, check the marker text still matches the file tail")
        sys.exit(1)
    patched = html.replace(MARKER, HOOK + MARKER, 1)
    # 4.0.73: Neuinstallation folgt der Systemsprache (navigator.language). jsdom meldet immer en-US – die jsdom-Tests sind für
    # deutsches Windows geschrieben, darum dort de-DE vortäuschen. Echte Browser (Playwright) behalten ihre Sprache/locale.
    patched = ('<meta charset="utf-8">' + "<script>try{ if (/jsdom/i.test(navigator.userAgent)) Object.defineProperty(navigator, 'language', { get: function(){ return 'de-DE'; } }); }catch(e){}</script>") + patched   # Datei hat kein <head> – ganz an den Anfang
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(patched)
    print("wrote", out_path)

if __name__ == "__main__":
    main()
