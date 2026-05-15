// lib/badges.js - Modified version
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
const { reportBug } = require('../lib/errorReporter');
const crypto = require('crypto');
const util = require('util');
const default_achievements = require('../data/default_achievements');
const ACHIEVEMENT_DIFFICULTY_XP_MAP = require('../data/achievement_difficulty_xp_map');

// XP values: score type (Par, Birdie, Eagle, Albatross, Ace)
const XP_SCORE = { bogey: 5, par: 10, birdie: 15, eagle: 50, albatross: 250, ace: 500 };
// Badge tier XP: Bronze, Silver, Gold, Platinum, Diamond, Emerald, Ruby, Cosmic (tier index 0..7, 8+ = Cosmic)
const XP_TIER = [100, 250, 500, 1000, 2500, 5000, 7500, 10000];
const XP_BONUS = { cleanRound: 100, noOB: 50, circleTwoChamp: 100 };
const XP_MULTIPLIER = {
  hotStreakPerBirdie: 1.2,
  weeklyStreak: 0.05,
  verifiedRound: 0.05,
  bogeyFreeStreak: 0.05
};

function emptyXpScoreBreakdown() {
  return Object.fromEntries(Object.keys(XP_SCORE).map((k) => [k, 0]));
}

/**
 * Marginal XP from % multipliers (order matches `multiplier`: +verified, +weekly, +bogeyFreeStreak).
 */
function splitRoundMultiplierPremium(roundXP, bonuses) {
  const v = bonuses.verifiedRound ? XP_MULTIPLIER.verifiedRound : 0;
  const w = bonuses.weeklyStreak ? XP_MULTIPLIER.weeklyStreak : 0;
  const b = bonuses.bogeyFreeStreak ? XP_MULTIPLIER.bogeyFreeStreak : 0;
  const baseRounded = Math.round(roundXP);
  const withV = Math.round(roundXP * (1 + v));
  const withVW = Math.round(roundXP * (1 + v + w));
  const withVWB = Math.round(roundXP * (1 + v + w + b));
  return {
    verifiedRound: bonuses.verifiedRound ? withV - baseRounded : 0,
    weeklyStreak: bonuses.weeklyStreak ? withVW - Math.round(roundXP * (1 + v)) : 0,
    bogeyFreeStreak: bonuses.bogeyFreeStreak ? withVWB - Math.round(roundXP * (1 + v + w)) : 0
  };
}

function getHolesFromLayout(layout) {
  if (!layout) return [];
  return layout.latestVersion && Array.isArray(layout.latestVersion.holes)
    ? layout.latestVersion.holes
    : Array.isArray(layout.holes)
      ? layout.holes
      : [];
}

/** One result per hole for this player (latest timestamp wins). */
function latestPlayerResultsByHole(scorecard, playerIdObj) {
  const idStr = String(playerIdObj);
  const raw = Array.isArray(scorecard?.results) ? scorecard.results : [];
  const byHole = {};
  for (const r of raw) {
    const pid = r?.entityId ?? r?.playerId;
    if (pid == null || String(pid) !== idStr) continue;
    const holeNum = r.holeNumber;
    if (holeNum == null) continue;
    const key = String(holeNum);
    const prev = byHole[key];
    if (
      !prev ||
      (r.timestamp && prev.timestamp && r.timestamp > prev.timestamp) ||
      (r.timestamp && !prev.timestamp)
    ) {
      byHole[key] = r;
    }
  }
  return Object.values(byHole).sort((a, b) => a.holeNumber - b.holeNumber);
}

function isPlayerBogeyFreeRound(playerResults, holes) {
  if (!Array.isArray(playerResults) || playerResults.length === 0) return false;
  return calculateRoundXP(playerResults, holes).cleanRound;
}

/**
 * Per-player XP attribution for one round, aligned to XP_SCORE / XP_BONUS / XP_MULTIPLIER.
 * `badges` is the total XP from all badge grants this round: tiered progress (`bo.xp` sum) plus
 * unique badges earned (`XP_TIER[0]` each).
 */
function buildPlayersXpBreakdownEntry(
  entityId,
  roundXPResult,
  bonuses,
  badgeObjectsWithXP,
  uniqueBadgesEarnedThisRound = 0
) {
  let roundXP = roundXPResult.baseXP + roundXPResult.hotStreakXP;
  const circleTwoChampXp =
    (Number(roundXPResult.circleTwoPutts) || 0) * XP_BONUS.circleTwoChamp;
  roundXP += circleTwoChampXp;
  if (roundXPResult.cleanRound) roundXP += XP_BONUS.cleanRound;
  if (roundXPResult.noOB) roundXP += XP_BONUS.noOB;

  let badgesXpThisRound = 0;
  for (const bo of badgeObjectsWithXP || []) {
    badgesXpThisRound += Number(bo.xp) || 0;
  }
  if (uniqueBadgesEarnedThisRound > 0) {
    badgesXpThisRound += uniqueBadgesEarnedThisRound * XP_TIER[0];
  }

  const multParts = splitRoundMultiplierPremium(roundXP, bonuses);

  const idObj =
    entityId instanceof ObjectId ? entityId : ObjectId.isValid(entityId) ? new ObjectId(entityId) : entityId;

  return {
    entityId: idObj,
    score: { ...roundXPResult.xpByScoreType },
    badges: badgesXpThisRound,
    bonus: {
      cleanRound: roundXPResult.cleanRound ? XP_BONUS.cleanRound : 0,
      noOB: roundXPResult.noOB ? XP_BONUS.noOB : 0,
      circleTwoChamp: circleTwoChampXp
    },
    multipliers: {
      hotStreakPerBirdie: roundXPResult.hotStreakXP,
      verifiedRound: multParts.verifiedRound,
      weeklyStreak: multParts.weeklyStreak,
      bogeyFreeStreak: multParts.bogeyFreeStreak
    }
  };
}

/**
 * Calculate round XP from player results: score XP per hole, hot streak on birdies, clean round, no OB.
 * @param {Array} playerResults - Sorted by holeNumber, each { holeNumber, score, obCount }
 * @param {Array} holes - Layout holes with { number, par }
 * @returns {{ baseXP: number, hotStreakXP: number, cleanRound: boolean, noOB: boolean, circleTwoPutts: number, xpByScoreType: Record<string, number>, breakdown: object }}
 */
function calculateRoundXP(playerResults, holes) {
  let baseXP = 0;
  let hotStreakXP = 0;
  let consecutiveBirdies = 0;
  let bogeyFree = true;
  let totalOB = 0;
  let circleTwoPutts = 0;
  const holeXP = [];
  const xpByScoreType = emptyXpScoreBreakdown();

  const sortedResults = [...playerResults].sort((a, b) => a.holeNumber - b.holeNumber);

  for (const r of sortedResults) {
    if (r?.specifics && r.specifics.c2 === true) {
      circleTwoPutts += 1;
    }
    const hole = holes.find(h => (h.number || h.holeNumber) === r.holeNumber);
    const par = hole && (hole.par != null) ? hole.par : 3;
    const strokesVsPar = par - r.score;
    let xp = 0;
    let scoreKey = null;
    if (r.score === 1) {
      xp = XP_SCORE.ace;
      scoreKey = 'ace';
    } else if (strokesVsPar >= 3) {
      xp = XP_SCORE.albatross;
      scoreKey = 'albatross';
    } else if (strokesVsPar === 2) {
      xp = XP_SCORE.eagle;
      scoreKey = 'eagle';
    } else if (strokesVsPar === 1) {
      xp = XP_SCORE.birdie;
      scoreKey = 'birdie';
      consecutiveBirdies++;
      hotStreakXP += xp * (Math.pow(XP_MULTIPLIER.hotStreakPerBirdie, consecutiveBirdies - 1) - 1);
    } else if (strokesVsPar === 0) {
      xp = XP_SCORE.par;
      scoreKey = 'par';
      consecutiveBirdies = 0;
    } else if (strokesVsPar === -1) {
      xp = XP_SCORE.bogey;
      scoreKey = 'bogey';
      consecutiveBirdies = 0;
      bogeyFree = false;
    } else {
      consecutiveBirdies = 0;
      bogeyFree = false;
    }
    baseXP += xp;
    if (scoreKey) xpByScoreType[scoreKey] += xp;
    totalOB += typeof r.obCount === 'number' ? r.obCount : 0;
    holeXP.push({ holeNumber: r.holeNumber, xp });
  }

  return {
    baseXP,
    hotStreakXP: Math.round(hotStreakXP),
    cleanRound: bogeyFree,
    noOB: totalOB === 0,
    totalOB,
    circleTwoPutts,
    xpByScoreType,
    breakdown: { holeXP }
  };
}

/**
 * Get XP bonus flags: verified round, weekly play streak (2+ weeks), bogey-free streak (this + prior round).
 * `roundFlags.cleanRoundThisRound` must be from {@link calculateRoundXP}. `roundFlags.scorecardId` excludes this card when loading the prior completed round.
 */
async function getXPBonuses(db, playerId, scorecard, roundFlags = {}) {
  const scorecardsCollection = db.collection('scorecards');
  const playerIdObj = playerId instanceof ObjectId ? playerId : new ObjectId(playerId);

  let verifiedRound = false;

  if (scorecard && Array.isArray(scorecard.results)) {
    const playerIdsOnCard = [
      ...new Set(
        scorecard.results
          .map((r) => {
            const p = r?.playerId ?? r?.entityId;
            return p != null ? String(p) : null;
          })
          .filter(Boolean)
      )
    ];
    verifiedRound = playerIdsOnCard.length > 1;
  }

  const thisRoundDate =
    scorecard && (scorecard.updatedAt || scorecard.createdAt)
      ? new Date(scorecard.updatedAt || scorecard.createdAt)
      : new Date();

  const { scorecardId, cleanRoundThisRound } = roundFlags;
  const needBogeyFree = Boolean(cleanRoundThisRound && scorecardId != null);
  const excludeId = needBogeyFree
    ? (scorecardId instanceof ObjectId ? scorecardId : new ObjectId(String(scorecardId)))
    : null;

  const baseMatch = {
    status: 'completed',
    $or: [
      { 'results.playerId': playerIdObj },
      { 'results.entityId': playerIdObj }
    ]
  };

  const [facetResult] = await scorecardsCollection.aggregate([
    { $match: baseMatch },
    {
      $facet: {
        forWeekly: [
          { $sort: { updatedAt: -1 } },
          { $limit: 100 },
          { $project: { _id: 0, updatedAt: 1, completedAt: 1 } }
        ],
        forBogeyFree: needBogeyFree
          ? [
              { $match: { _id: { $ne: excludeId } } },
              { $sort: { updatedAt: -1 } },
              { $limit: 1 },
              { $project: { results: 1, layout: 1 } }
            ]
          : [{ $limit: 0 }]
      }
    }
  ]).toArray();

  const weekSet = new Set();
  for (const sc of facetResult?.forWeekly ?? []) {
    const d = sc.updatedAt || sc.completedAt;
    if (d) weekSet.add(getWeekKey(d));
  }
  weekSet.add(getWeekKey(thisRoundDate));
  const thisWeek = getWeekKey(thisRoundDate);
  const lastWeek = getWeekKey(subtractWeeks(thisRoundDate, 1));
  const weeklyStreak = weekSet.has(thisWeek) && weekSet.has(lastWeek);

  let bogeyFreeStreak = false;
  const prev = facetResult?.forBogeyFree?.[0];
  if (needBogeyFree && prev) {
    const prevRows = latestPlayerResultsByHole(prev, playerIdObj);
    const prevHoles = getHolesFromLayout(prev.layout);
    bogeyFreeStreak = prevRows.length > 0 && isPlayerBogeyFreeRound(prevRows, prevHoles);
  }

  return { verifiedRound, weeklyStreak, bogeyFreeStreak };
}

function getWeekKey(d) {
  const date = d instanceof Date ? d : new Date(d);
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  start.setUTCHours(0, 0, 0, 0);
  return start.getTime();
}

function subtractWeeks(d, weeks) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() - weeks * 7);
  return out;
}

// Load badge definitions from database
const getBadgeDefinitions = async (db) => {
  const badgeDefinitionsCollection = db.collection('badgeDefinitions');
  const result = await badgeDefinitionsCollection.find({ done: true /*, id: { $in: ["flock_of_birdies", "birdie_hunter"] } */ }).toArray();
  return result ? result : [];
};

const parseYesNo = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'yes') return true;
  if (normalized === 'no') return false;
  return null;
};

const getXpForAchievementDifficulty = (difficulty) => {
  const key = String(difficulty ?? '').trim().toLowerCase();
  const amount = ACHIEVEMENT_DIFFICULTY_XP_MAP[key];
  return Number.isFinite(amount) ? amount : 0;
};

const normalizeCourseId = (courseId) => {
  if (courseId instanceof ObjectId) return courseId;
  if (ObjectId.isValid(courseId)) return new ObjectId(courseId);
  return courseId;
};

const getHolePar = (hole) => {
  if (!hole) return 3;
  if (typeof hole.par === 'number') return hole.par;
  const parsed = Number(hole.par);
  return Number.isFinite(parsed) ? parsed : 3;
};

const normalizeAchievementZone = (zone) => {
  if (zone == null) return null;
  const normalized = String(zone).trim().toUpperCase();
  if (normalized === 'C1' || normalized === 'C2' || normalized === 'BULLSEYE') return normalized;
  return null;
};

const normalizeAchievementResult = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'ace') return { type: 'ace' };
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) return { type: 'delta', value: parsed };
  return null;
};

const resultMatchesAchievementResult = (result, hole, expectedResult) => {
  if (!expectedResult) return true;
  const score = Number(result?.score);
  if (!Number.isFinite(score)) return false;
  if (expectedResult.type === 'ace') return score === 1;
  if (expectedResult.type === 'delta') {
    const par = getHolePar(hole);
    return (score - par) === expectedResult.value;
  }
  return false;
};

const resultMatchesAchievementZone = (result, expectedZone) => {
  if (!expectedZone) return true;
  const specifics = result?.specifics || {};
  if (expectedZone === 'C1') return Boolean(specifics.c1);
  if (expectedZone === 'C2') return Boolean(specifics.c2);
  if (expectedZone === 'BULLSEYE') return Boolean(specifics.bullseye);
  return false;
};

const getAchievementId = (achievementDef) => String(achievementDef?.id || achievementDef?._id || '');

const getRoundLayoutId = (layout) => {
  if (!layout) return null;
  const id = layout._id ?? layout.id;
  return id != null && String(id).trim() !== '' ? String(id) : null;
};

/** Normalized layout id list; empty means the achievement applies to all layouts. */
const getAchievementLayoutIds = (ach) => {
  const raw = Array.isArray(ach?.layoutIds)
    ? ach.layoutIds
    : (ach?.layoutId != null && ach?.layoutId !== '' ? [ach.layoutId] : []);
  return raw
    .map((id) => (id != null ? String(id).trim() : ''))
    .filter(Boolean);
};

const achievementAppliesToRoundLayout = (ach, roundLayoutId) => {
  const allowed = getAchievementLayoutIds(ach);
  if (!allowed.length) return true;
  if (!roundLayoutId) return false;
  return allowed.includes(String(roundLayoutId));
};

const getAchievementRoundProgress = ({
  relevantResults,
  expectedResult,
  expectedZone,
  holesByNumber,
  requireConsecutiveHoles = false,
  scrambleFilter = null
}) => {
  if (!Array.isArray(relevantResults) || relevantResults.length === 0) {
    return { matchCount: 0, bestRun: 0 };
  }

  const sorted = [...relevantResults].sort((a, b) => Number(a?.holeNumber) - Number(b?.holeNumber));
  const predicate = (r) => {
    const usesScramble = resultUsesScramble(r);
    if (scrambleFilter === true && !usesScramble) return false;
    if (scrambleFilter === false && usesScramble) return false;
    const hole = holesByNumber.get(Number(r?.holeNumber));
    return resultMatchesAchievementResult(r, hole, expectedResult) &&
      resultMatchesAchievementZone(r, expectedZone);
  };

  let matchCount = 0;
  let bestRun = 0;
  let currentRun = 0;
  let previousHoleNumber = null;

  for (const r of sorted) {
    const holeNum = Number(r?.holeNumber);
    const holeOk = Number.isFinite(holeNum);
    const matches = holeOk && predicate(r);

    if (matches) {
      matchCount += 1;
      const extendsStreak =
        !requireConsecutiveHoles ||
        previousHoleNumber == null ||
        holeNum === previousHoleNumber + 1;
      if (extendsStreak) {
        currentRun += 1;
      } else {
        currentRun = 1;
      }
      if (currentRun > bestRun) bestRun = currentRun;
    } else {
      currentRun = 0;
    }
    if (holeOk) {
      previousHoleNumber = holeNum;
    }
  }

  return { matchCount, bestRun };
};



const scorecardIsVerifiedRound = (scorecard) => {
  if (!scorecard || !Array.isArray(scorecard.results)) return false;
  const dnfSet = new Set((scorecard.dnf || []).map((entry) => String(entry)));
  const completedPlayers = new Set();
  for (const r of scorecard.results) {
    const playerId = r?.playerId ?? r?.entityId;
    if (playerId == null) continue;
    const key = String(playerId);
    if (dnfSet.has(key)) continue;
    completedPlayers.add(key);
  }
  return completedPlayers.size >= 2;
};



const resultUsesScramble = (result) => {
  const specifics = result?.specifics || {};
  if (typeof specifics.scrambe === 'boolean') return specifics.scrambe;
  if (typeof specifics.scramble === 'boolean') return specifics.scramble;
  return false;
};

 

const searchForEarnedAchievements = async ({ scorecardId, results, courseId, layout, scorecard }) => {
  const db = getDatabase();
  const achievementsCollection = db.collection('achievements');
  const activeDefaultCourseAchievementsCollection = db.collection('active-default-course-achievements');
  const achievementProgressCollection = db.collection('userAchievementProgress');
  const courseFilterId = normalizeCourseId(courseId);

  const configuredDefaultsDoc = await activeDefaultCourseAchievementsCollection.findOne({ courseId: courseFilterId });
  const configuredTemplateIds = Array.isArray(configuredDefaultsDoc?.templateIds)
    ? configuredDefaultsDoc.templateIds.map((id) => String(id))
    : [];
  const configuredTemplateIdSet = new Set(configuredTemplateIds);

  const defaultAchievementDefs = configuredTemplateIdSet.size > 0
    ? default_achievements.filter((ach) => configuredTemplateIdSet.has(String(ach?.id)))
    : default_achievements;

  const courseAchievementDefs = await achievementsCollection.find({ courseId: courseFilterId }).toArray();

  const achievementDefs = [
    ...courseAchievementDefs,
    ...defaultAchievementDefs
  ];

  const achievementDefsById = new Map();
  for (const ach of achievementDefs) {
    const achievementId = getAchievementId(ach);
    if (!achievementId || achievementDefsById.has(achievementId)) continue;
    achievementDefsById.set(achievementId, ach);
  }
  const dedupedAchievementDefs = Array.from(achievementDefsById.values());

  if (!dedupedAchievementDefs.length) return [];

  const holes = (layout?.latestVersion && Array.isArray(layout.latestVersion.holes))
    ? layout.latestVersion.holes
    : Array.isArray(layout?.holes) ? layout.holes : [];
  const holesByNumber = new Map();
  holes.forEach((h, idx) => {
    const holeNumber = Number(h?.number ?? h?.holeNumber ?? idx + 1);
    if (Number.isFinite(holeNumber)) holesByNumber.set(holeNumber, h);
  });

  const playerResultsMap = new Map();
  (results || []).forEach((r) => {
    const userId = r?.entityId ?? r?.playerId;
    if (userId == null) return;
    const key = String(userId);
    if (!playerResultsMap.has(key)) playerResultsMap.set(key, []);
    playerResultsMap.get(key).push(r);
  });

  const isVerifiedRound = scorecardIsVerifiedRound(scorecard);
  const roundLayoutId = getRoundLayoutId(layout);
  const earnedPerPlayer = [];
  const progressOps = [];
  /** @type {Map<string, number>} */
  const achievementXpByUserStr = new Map();
  const scorecardIdObj = ObjectId.isValid(scorecardId) ? new ObjectId(scorecardId) : scorecardId;

  for (const [userId, playerResults] of playerResultsMap.entries()) {
    const earnedAchievements = [];
    const normalizedPlayerId = ObjectId.isValid(userId) ? new ObjectId(userId) : userId;
    const existingProgressDocs = await achievementProgressCollection.find({
      userId: normalizedPlayerId,
      achievementId: {
        $in: dedupedAchievementDefs
          .map((a) => getAchievementId(a))
          .filter(Boolean)
      }
    }).toArray();
    const existingProgressMap = new Map(existingProgressDocs.map((d) => [String(d.achievementId), d]));

    for (const ach of dedupedAchievementDefs) {
      if (!achievementAppliesToRoundLayout(ach, roundLayoutId)) continue;

      const selectedHoles = Array.isArray(ach.selectedHoles)
        ? ach.selectedHoles
          .filter((n) => String(n).toLowerCase() !== 'any')
          .map((n) => Number(n))
          .filter(Number.isFinite)
        : [];
      let relevantResults = selectedHoles.length
        ? playerResults.filter((r) => selectedHoles.includes(Number(r.holeNumber)))
        : playerResults;
      if (!relevantResults.length) continue;

      if (selectedHoles.length) {
        const covered = new Set(relevantResults.map((r) => Number(r.holeNumber)));
        if (!selectedHoles.every((n) => covered.has(n))) continue;
      }

      const mustBeParRaw = ach?.condition?.mustBePar;
      let allowedPars = null;
      if (Array.isArray(mustBeParRaw)) {
        const vals = mustBeParRaw.map((n) => Number(n)).filter(Number.isFinite);
        if (vals.length) allowedPars = new Set(vals);
      } else {
        const n = Number(mustBeParRaw);
        if (Number.isFinite(n)) allowedPars = new Set([n]);
      }
      if (allowedPars) {
        relevantResults = relevantResults.filter((r) => {
          const hole = holesByNumber.get(Number(r?.holeNumber));
          return allowedPars.has(getHolePar(hole));
        });
        if (!relevantResults.length) continue;
      }

      const allowOb = parseYesNo(ach.condition?.obAllowed);
      if (allowOb === false) {
        const hasOB = relevantResults.some((r) => Number(r.obCount || 0) > 0);
        if (hasOB) continue;
      }

      const requiresVerified = Boolean(ach.verifiedOnly);
      if (requiresVerified && !isVerifiedRound) continue;

      const scrambleFilter = parseYesNo(ach.condition?.scramble);

      const expectedResult = normalizeAchievementResult(ach.result);
      const expectedZone = normalizeAchievementZone(ach.zone);
      const streakMinimum = Number(ach?.streak?.minimum);
      const streakScope = typeof ach?.streak === 'string'
        ? ach.streak
        : (ach?.streak?.scope || 'same-round');
      const achievementId = getAchievementId(ach);
      if (!achievementId) continue;

      const existingProgress = existingProgressMap.get(achievementId);
      const alreadyWonAchievement = Boolean(existingProgress?.won === true);
      const alreadyCountedThisScorecard = Boolean(
        existingProgress &&
        Array.isArray(existingProgress.scorecardIds) &&
        existingProgress.scorecardIds.some((id) => String(id) === String(scorecardIdObj))
      );

      const minRequired = Number.isFinite(streakMinimum) && streakMinimum > 0 ? Math.floor(streakMinimum) : 1;
      const roundProgress = getAchievementRoundProgress({
        relevantResults,
        expectedResult,
        expectedZone,
        holesByNumber,
        requireConsecutiveHoles: streakScope === 'in-a-row-same-round',
        scrambleFilter
      });
      const roundContribution = streakScope === 'in-a-row-same-round'
        ? roundProgress.bestRun
        : roundProgress.matchCount;
      const accumulatesAcrossRounds = streakScope === 'multi-round';
      const previousProgress = Number(existingProgress?.progress || 0);
      const nextProgress = accumulatesAcrossRounds
        ? (
            alreadyCountedThisScorecard
              ? previousProgress
              : previousProgress + roundContribution
          )
        : roundContribution;
      const streakSatisfied = nextProgress >= minRequired;
      const persistedWon = streakSatisfied || alreadyWonAchievement;

      let shouldPersistProgress = false;
      const roundScopedStreak =
        streakScope === 'in-a-row-same-round' || streakScope === 'same-round';
      if (roundScopedStreak) {
        shouldPersistProgress =
          streakSatisfied && !(alreadyCountedThisScorecard && alreadyWonAchievement);
      } else if (!alreadyCountedThisScorecard) {
        if (accumulatesAcrossRounds) {
          shouldPersistProgress = roundContribution > 0;
        } else {
          shouldPersistProgress = Boolean(existingProgress) || roundContribution > 0;
        }
      }

      if (alreadyWonAchievement) shouldPersistProgress = false;

      const xpEarned = streakSatisfied && !alreadyWonAchievement
        ? getXpForAchievementDifficulty(ach.difficulty)
        : 0;

      if (shouldPersistProgress && xpEarned > 0) {
        const userKey = String(normalizedPlayerId);
        achievementXpByUserStr.set(
          userKey,
          (achievementXpByUserStr.get(userKey) || 0) + xpEarned
        );
      }

      if (shouldPersistProgress) {
        progressOps.push({
          updateOne: {
            filter: {
              userId: normalizedPlayerId,
              achievementId
            },
            update: {
              $set: {
                title: ach.title,
                description: ach.description,
                difficulty: ach.difficulty,
                reward: ach.reward,
                courseId: courseFilterId,
                layoutId: layout?._id || layout?.id || null,
                streakScope: String(streakScope),
                streakMinimum: Number.isFinite(streakMinimum) && streakMinimum > 0 ? Math.floor(streakMinimum) : 1,
                verifiedOnly: Boolean(ach.verifiedOnly),
                progress: nextProgress,
                won: persistedWon,
                completed: persistedWon,
                updatedAt: new Date(),
                lastProgressAt: new Date(),
                ...(xpEarned > 0 ? { xpEarned } : {}),
                ...(streakSatisfied && !alreadyWonAchievement
                  ? { lastEarnedAt: new Date(), wonAt: new Date() }
                  : {})
              },
              $setOnInsert: {
                userId: normalizedPlayerId,
                achievementId,
                createdAt: new Date()
              },
              $addToSet: {
                scorecardIds: scorecardIdObj
              }
            },
            upsert: true
          }
        });
      }

      if (!shouldPersistProgress) continue;
      if (alreadyWonAchievement) continue;

      earnedAchievements.push({
        id: achievementId,
        title: ach.title,
        description: ach.description,
        difficulty: ach.difficulty,
        reward: ach.reward,
        won: streakSatisfied,
        completed: streakSatisfied
      });
    }

    earnedPerPlayer.push({
      entityId:userId,
      achievements: earnedAchievements
    });
  }

  let achievementPersistOk = true;
  if (progressOps.length > 0) {
    try {
      await achievementProgressCollection.bulkWrite(progressOps, { ordered: false });
    } catch (error) {
      achievementPersistOk = false;
      console.error('[searchForEarnedAchievements] Failed to persist achievement progress:', error);
    }
  }

  if (achievementPersistOk && achievementXpByUserStr.size > 0) {
    try {
      const userXPTotalsCollection = db.collection('userXPTotals');
      const xpIncrementOps = [...achievementXpByUserStr.entries()].map(([userIdStr, totalXP]) => {
        const userIdObj = ObjectId.isValid(userIdStr) ? new ObjectId(userIdStr) : userIdStr;
        return {
          updateOne: {
            filter: { _id: userIdObj },
            update: {
              $inc: { totalXP },
              $setOnInsert: { _id: userIdObj }
            },
            upsert: true
          }
        };
      });
      await userXPTotalsCollection.bulkWrite(xpIncrementOps);
    } catch (xpErr) {
      console.error('[searchForEarnedAchievements] Failed to increment user totalXP:', xpErr);
    }
  }

  return earnedPerPlayer;
};

const searchForEarnedBadges = async ({ scorecardId, results, courseId, layout, scorecard }) => {  
  const db = getDatabase();
  const progressCollection = db.collection('userBadgeProgress');

  const holes = (layout.latestVersion && Array.isArray(layout.latestVersion.holes))
    ? layout.latestVersion.holes
    : Array.isArray(layout.holes) ? layout.holes : []; 

  // Normalize layout shape used by badge conditions
  const normalizedLayout = {
    holes: holes.map((h, index) => ({
      holeNumber: h.number || h.holeNumber,
      number: h.number,
      par: h.par,
      length: h.length,
      measureInMeters: h.measureInMeters
    }))
  };

  const playerIdMap = new Map();
  const dnfSet = new Set();
  if (scorecard && Array.isArray(scorecard.dnf)) {
    for (const entry of scorecard.dnf) {
      if (entry == null) continue;
      dnfSet.add(entry instanceof ObjectId ? entry.toString() : String(entry));
    }
  }
  const idInDnf = (id) => {
    if (id == null || dnfSet.size === 0) return false;
    const k = id instanceof ObjectId ? id.toString() : String(id);
    return dnfSet.has(k);
  };
  const effectiveResults =
    dnfSet.size === 0
      ? results
      : results.filter((r) => !idInDnf(r.entityId));

  effectiveResults.forEach(r => {
    const pid = r.entityId;
    if (pid == null) return;
    let normalizedId;
    if (pid instanceof ObjectId) {
      normalizedId = pid;
    } else if (ObjectId.isValid(pid)) {
      normalizedId = new ObjectId(pid);
    } else {
      normalizedId = pid;
    }
    const idStr = String(normalizedId);
    if (!playerIdMap.has(idStr)) {
      playerIdMap.set(idStr, normalizedId);
    }
  });
  const uniquePlayerIds = Array.from(playerIdMap.values());

  const badgeDefinitions = await getBadgeDefinitions(db);

  // Separate badges that require historical data
  const historicalBadges = badgeDefinitions.filter(b => b.requiresHistoricalData);
  const regularBadges = badgeDefinitions.filter(b => !b.requiresHistoricalData);

  // Precompute global tier statistics per badge using a single aggregate on userBadgeProgress
  const tieredBadges = badgeDefinitions.filter(
    b => Array.isArray(b.tierThresholds) && b.tierThresholds.length > 0
  );
  const tieredBadgeIds = tieredBadges.map(b => b.id);

  let badgeTierStatsMap = {};
  if (tieredBadgeIds.length > 0) {
    try {
      const tierAgg = await progressCollection.aggregate([
        { $match: { badgeId: { $in: tieredBadgeIds } } },
        {
          $group: {
            _id: { badgeId: '$badgeId', currentTier: '$currentTier' },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.badgeId',
            totalUsers: { $sum: '$count' },
            tierCounts: {
              $push: {
                tier: '$_id.currentTier',
                count: '$count'
              }
            }
          }
        }
      ]).toArray();

      const aggByBadgeId = {};
      tierAgg.forEach(doc => {
        aggByBadgeId[doc._id] = {
          totalUsers: doc.totalUsers || 0,
          tierCounts: doc.tierCounts || []
        };
      });

      badgeTierStatsMap = tieredBadges.reduce((acc, badgeDef) => {
        const aggEntry = aggByBadgeId[badgeDef.id] || { totalUsers: 0, tierCounts: [] };
        const totalUsers = aggEntry.totalUsers;

        const countByTier = {};
        aggEntry.tierCounts.forEach(({ tier, count }) => {
          if (typeof tier === 'number') {
            countByTier[tier] = (countByTier[tier] || 0) + count;
          }
        });

        const tiers = badgeDef.tierThresholds.map((threshold, tierIndex) => {
          const count = Object.entries(countByTier).reduce((sum, [t, c]) => {
            const tNum = Number(t);
            return tNum >= tierIndex ? sum + c : sum;
          }, 0);
          const percentage = totalUsers > 0 ? (count / totalUsers) * 100 : 0;

          return {
            tierIndex,
            threshold,
            count,
            percentage
          };
        });

        acc[badgeDef.id] = {
          badgeId: badgeDef.id,
          totalUsers,
          tiers
        };

        return acc;
      }, {});
    } catch (error) {
      console.error('[searchForEarnedBadges] Failed to compute badge tier percentages:', error);
    }
  }

  // Precompute global statistics for unique badges (percentage of users who have earned each unique badge)
  const uniqueBadgeIds = badgeDefinitions
    .filter(b => b.isUnique === true)
    .map(b => b.id);

  let uniqueBadgeStatsMap = {};
  if (uniqueBadgeIds.length > 0) {
    try {
      const uniqueAgg = await progressCollection.aggregate([
        { $match: { badgeId: { $in: uniqueBadgeIds } } },
        // First group by user + badge to avoid counting the same user multiple times per badge
        {
          $group: {
            _id: { badgeId: '$badgeId', userId: '$userId' },
            currentTier: { $max: { $ifNull: ['$currentTier', -1] } },
            totalProgress: { $max: { $ifNull: ['$totalProgress', 0] } }
          }
        },
        // Now aggregate per badgeId
        {
          $group: {
            _id: '$_id.badgeId',
            totalUsers: { $sum: 1 },
            holders: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $gte: ['$currentTier', 0] },
                      { $gt: ['$totalProgress', 0] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $project: {
            _id: 1,
            totalUsers: 1,
            holders: 1,
            percentage: {
              $cond: [
                { $gt: ['$totalUsers', 0] },
                { $multiply: [{ $divide: ['$holders', '$totalUsers'] }, 100] },
                0
              ]
            }
          }
        }
      ]).toArray();

      uniqueBadgeStatsMap = uniqueAgg.reduce((acc, doc) => {
        acc[doc._id] = {
          badgeId: doc._id,
          totalUsers: doc.totalUsers || 0,
          holders: doc.holders || 0,
          percentage: typeof doc.percentage === 'number' ? doc.percentage : 0
        };
        return acc;
      }, {});
    } catch (error) {
      console.error('[searchForEarnedBadges] Failed to compute unique badge percentages:', error);
    }
  }

  const perPlayerEarned = [];
  const playersXpBreakdown = [];
  const docsToInsert = [];
  const bulkOps = [];
  const xpIncrements = [];

  const courseIdObj = ObjectId.isValid(courseId) ? new ObjectId(courseId) : courseId;

  // Cache historical badge results to avoid duplicate calls for the same player
  const historicalBadgeCache = new Map();

  for (const playerIdObj of uniquePlayerIds) {
    // Normalize to ObjectId for comparison
    const playerId = playerIdObj instanceof ObjectId ? playerIdObj : (ObjectId.isValid(playerIdObj) ? new ObjectId(playerIdObj) : playerIdObj);
    const playerIdStr = String(playerId);
  
    // Filter results - compare ObjectIds directly

    const playerResults = effectiveResults.filter(r => {
      const rId = r.entityId;
      const rPlayerId = rId instanceof ObjectId ? rId : (ObjectId.isValid(rId) ? new ObjectId(rId) : rId);
      return rPlayerId.equals ? rPlayerId.equals(playerId) : rPlayerId === playerId;
    });
    const allOtherPlayersResults = effectiveResults.filter(r => {
      const rId = r.entityId;
      const rPlayerId = rId instanceof ObjectId ? rId : (ObjectId.isValid(rId) ? new ObjectId(rId) : rId);
      return !(rPlayerId.equals ? rPlayerId.equals(playerId) : rPlayerId === playerId);
    });

    const earnedForPlayer = [];
    let progressForPlayer = [];

    // Check regular badge conditions for this player (current round only)
    for (const badgeDef of regularBadges) {
      try {

        const conditionResult = executeBadgeCondition(
          badgeDef, 
          playerResults, 
          normalizedLayout, 
          { 
            allOtherPlayersResults,
            currentScorecardId: scorecardId
          }
        );
        
        if (conditionResult !== false && conditionResult !== 0) {
          
          if (badgeDef.isUnique) {
            
            earnedForPlayer.push({
              name: badgeDef.name,
              courseId: courseId,
              badgeId: badgeDef.id,
              type: 'unique',
              layoutId: layout && (layout._id || layout.id)
            });
          } else {
            
            const progressData = {
              badgeId: badgeDef.id,
              badgeName: badgeDef.name,
              progress: conditionResult,
              courseId: courseId,
              layoutId: layout && (layout._id || layout.id)
            };
            
            progressForPlayer.push(progressData);
          }
        }
      } catch (error) {
        console.error(`Error checking badge ${badgeDef.name}:`, error);
      }
    }

    // Check historical badges using aggregate query on all scorecards
    if (historicalBadges.length > 0) {
      try {
        // Use cache to avoid duplicate calls for the same player
        let historicalResults;
        if (historicalBadgeCache.has(playerIdStr)) {
          historicalResults = historicalBadgeCache.get(playerIdStr);
        } else {
          historicalResults = await checkHistoricalBadges(db, playerId, historicalBadges, courseId, scorecardId);
          historicalBadgeCache.set(playerIdStr, historicalResults);
        }
        
        // Merge historical badge results into earnedForPlayer and progressForPlayer
        for (const badgeResult of historicalResults) {
          if (badgeResult.earned) {
            earnedForPlayer.push({
              _id: deterministicObjectIdFromString(`${playerIdStr}-${badgeResult.badgeId}`),
              name: badgeResult.name,
              courseId: badgeResult.courseId || courseId,
              badgeId: badgeResult.badgeId,
              type: 'unique',
              layoutId: badgeResult.layoutId || (layout && (layout._id || layout.id))
            });
          }
          
          if (badgeResult.progress !== undefined && badgeResult.progress !== false && badgeResult.progress !== 0) {
            progressForPlayer.push({
              badgeId: badgeResult.badgeId,
              badgeName: badgeResult.name,
              progress: badgeResult.progress,
              courseId: badgeResult.courseId || courseId,
              layoutId: badgeResult.layoutId || (layout && (layout._id || layout.id))
            });
          }
        }
      } catch (error) {
        console.error(`\n❌ [searchForEarnedBadges] Error checking historical badges for player ${playerIdStr}:`, error);
        console.error(`   Error stack:`, error.stack);
      }
    } else {
      console.log(`\n📊 [searchForEarnedBadges] No historical badges to check for player ${playerIdStr}`);
    }

    

    function deterministicObjectIdFromString(str) {
      const hex = crypto
        .createHash('md5')           // or 'sha256'
        .update(str)
        .digest('hex')
        .slice(0, 24);               // 24 hex chars = 12 bytes

      return new ObjectId(hex);
    }

    // Handle unique badges (insert into badges collection)
    const uniqueBadgeDocsForPlayer = [];
    for (const badge of earnedForPlayer) {
      uniqueBadgeDocsForPlayer.push({
        ...(badge?._id !== undefined ? { _id: badge._id } : {}),
        userId: playerId,
        badgeName: badge.name,
        badgeId: badge.badgeId,
        courseId: courseId,
        layoutId: layout && (layout._id || layout.id),
        dateEarned: new Date(),
        verified: 'pending',
        verifiedBy: null,
        scorecardId: scorecardId
      });
    }

    // Fetch existing badge progress for this player
    const badgeIds = progressForPlayer.map(p => p.badgeId);
    const existingProgressDocs = badgeIds.length > 0
      ? await progressCollection.find({
          userId: playerId,
          badgeId: { $in: badgeIds }
        }).toArray()
      : [];
    
    const existingProgressMap = {};
    existingProgressDocs.forEach(doc => {
      existingProgressMap[doc.badgeId] = {
        currentTier: doc.currentTier ?? -1,
        totalProgress: doc.totalProgress ?? 0,
        completedCourses: Array.isArray(doc.completedCourses) ? doc.completedCourses : []
      };
    });

    const { bulkOps: progressBulkOps, badgeObjects } = updateBadgeProgress(
      playerId, 
      progressForPlayer, 
      badgeDefinitions, 
      courseId, 
      (layout._id || layout.id), 
      scorecardId,
      existingProgressMap,
      badgeTierStatsMap,
      uniqueBadgeStatsMap
    );
    
    const badgeObjectsWithXP = badgeObjects.map(bo => {
      const tierXP = bo.currentTier >= 0
        ? (XP_TIER[Math.min(bo.currentTier, XP_TIER.length - 1)] || XP_TIER[XP_TIER.length - 1])
        : 0;
      const tierIncrementedGrantsXP = bo.tierIncremented && bo.currentTier >= 0;
      const uniqueEarnedThisRound =
        bo.isUnique &&
        bo.currentTier >= 0 &&
        Array.isArray(bo.tierThresholds) &&
        bo.tierThresholds.length > 0 &&
        bo.totalProgress >= bo.tierThresholds[0] &&
        (bo.previousTotalProgress ?? 0) < bo.tierThresholds[0];
      const xp = (tierIncrementedGrantsXP || uniqueEarnedThisRound) ? tierXP : 0;
      return { ...bo, xp };
    });
    const sortedProgressBadges = [...badgeObjectsWithXP].sort((a, b) => (b.progress || 0) - (a.progress || 0));

    // Calculate XP and queue user totalXP increment (helpers kept for future use)
    let totalXP = 0;
    let xpBreakdownRow = buildPlayersXpBreakdownEntry(
      playerId,
      {
        baseXP: 0,
        hotStreakXP: 0,
        cleanRound: false,
        noOB: true,
        totalOB: 0,
        circleTwoPutts: 0,
        xpByScoreType: emptyXpScoreBreakdown(),
        breakdown: { holeXP: [] }
      },
      { verifiedRound: false, weeklyStreak: false, bogeyFreeStreak: false },
      [],
      0
    );
    try {
      const roundXPResult = calculateRoundXP(playerResults, holes);
      const bonuses = await getXPBonuses(db, playerId, scorecard, {
        scorecardId,
        cleanRoundThisRound: roundXPResult.cleanRound
      });

      const circleTwoChampXp =
        (Number(roundXPResult.circleTwoPutts) || 0) * XP_BONUS.circleTwoChamp;

      let roundXP = roundXPResult.baseXP + roundXPResult.hotStreakXP + circleTwoChampXp;
      if (roundXPResult.cleanRound) roundXP += XP_BONUS.cleanRound;
      if (roundXPResult.noOB) roundXP += XP_BONUS.noOB;

      let multiplier = 1;
      if (bonuses.verifiedRound) multiplier += XP_MULTIPLIER.verifiedRound;
      if (bonuses.weeklyStreak) multiplier += XP_MULTIPLIER.weeklyStreak;
      if (bonuses.bogeyFreeStreak) multiplier += XP_MULTIPLIER.bogeyFreeStreak;
      const totalRoundXP = Math.round(roundXP * multiplier);

      const badgeTierXP = sortedProgressBadges.reduce((sum, bo) => sum + (bo.xp || 0), 0);

      totalXP = totalRoundXP + badgeTierXP;
      xpIncrements.push({ userId: playerId, totalXP });
      xpBreakdownRow = buildPlayersXpBreakdownEntry(
        playerId,
        roundXPResult,
        bonuses,
        badgeObjectsWithXP,
        uniqueBadgeDocsForPlayer.length
      );
    } catch (xpErr) {
      console.error(`[searchForEarnedBadges] XP calculation for player ${playerIdStr}:`, xpErr);
    }

    playersXpBreakdown.push(xpBreakdownRow);

    const uniqueBadgeXpThisRound = XP_TIER[0];
    for (const doc of uniqueBadgeDocsForPlayer) {
      docsToInsert.push({
        ...doc,
        totalXP: uniqueBadgeXpThisRound
      });
    }

    if (progressBulkOps && progressBulkOps.length > 0) {
      addPerBadgeXpToTierProgressOps(progressBulkOps, badgeObjectsWithXP);
      bulkOps.push(...progressBulkOps);
    }

    perPlayerEarned.push({
      entityId: playerIdStr,
      badges: sortedProgressBadges,
      xpEarned: totalXP,
    });
  }

  for (const doc of docsToInsert) {
    bulkOps.push({
      insertOne: {
        document: doc
      }
    });
  }

  async function bulkWriteWithOutcome(collection, ops) {
    var result;
    try {
      result = await collection.bulkWrite(ops, { ordered: false });

      return { ok: true, result, writeErrors: [] };
    } catch (err) {
      if (err?.code !== 11000) throw err;
  
      return {
        ok: false, // partial success
        original_result: result,
        result: err.result,                 // BulkWriteResult (as in your stack trace)
        writeErrors: err.writeErrors ?? [],  // array of WriteError
      };
    }
  }

  if (bulkOps.length > 0) {

    var { ok, original_result, result, writeErrors } = await bulkWriteWithOutcome(progressCollection, bulkOps);

    // console.log('result, writeErrors', result, writeErrors);
    const failedBadgeIds = new Set(
      writeErrors
        .map(we => we?.err?.op?._id)
        .filter(Boolean)
    );


    if (failedBadgeIds) {
      for (const ppe of perPlayerEarned) {
        ppe.badges = ppe.badges.filter(b => !failedBadgeIds.has(b._id));
      }
    }

  }

  if (xpIncrements.length > 0) {
    try {
      const userXPTotalsCollection = db.collection('userXPTotals');
      const xpIncrementOps = xpIncrements.map(({ userId, totalXP }) => {
        // Ensure userId is converted to ObjectId
        const userIdObj = userId instanceof ObjectId ? userId : (ObjectId.isValid(userId) ? new ObjectId(userId) : userId);
        return {
          updateOne: {
            filter: { _id: userIdObj },
            update: {
              $inc: { totalXP },
              $setOnInsert: { _id: userIdObj }
            },
            upsert: true
          }
        };
      });
      await userXPTotalsCollection.bulkWrite(xpIncrementOps);
      console.log(`\n📊 [searchForEarnedBadges] Incremented totalXP for ${xpIncrementOps.length} user(s) in userXPTotals`);
    } catch (xpSaveErr) {
      console.error('[searchForEarnedBadges] Failed to increment user totalXP:', xpSaveErr);
    }
  }

  return { perPlayerEarned, playersXpBreakdown };
};

/**
 * Check historical badges using a single aggregate query with $facet.
 *
 * For historical badges we want to do as much work as possible inside MongoDB's
 * aggregation pipeline instead of fetching all scorecards and post‑processing them
 * in Node. This function runs ALL historical badges in a single aggregate query
 * using $facet for parallel execution.
 *
 * Convention for historical badges:
 * - `badgeDef.condition` (string) contains a function body that, when executed,
 *   returns an object describing how to build the facet pipeline stages.
 *
 * Example `badgeDefinitions` document for "rounds on current course":
 *
 *   {
 *     id: 'rounds_on_current_course',
 *     name: 'Course Regular',
 *     requiresHistoricalData: true,
 *     isUnique: false,
 *     type: 'tiered',
 *     tierThresholds: [3, 10, 25],
 *     // NOTE: only the body of the function will be used – no need to include `function (...) {}`.
 *     condition: `
 *       // Build facet pipeline stages (without the initial $match, which is shared).
 *       // This counts how many completed scorecards this player has on the CURRENT course.
 *       const facetPipeline = [
 *         {
 *           $match: {
 *             courseId: courseId  // additional filter specific to this badge
 *           }
 *         },
 *         {
 *           $group: {
 *             _id: null,
 *             value: { $sum: 1 } // number of rounds on the current course
 *           }
 *         }
 *       ];
 *
 *       // Tell the badge system how to interpret the aggregation result:
 *       return {
 *         facetPipeline,  // stages to run inside the $facet (without shared $match)
 *         valueField: 'value', // field to read from the first facet result document
 *         asProgress: true     // use this numeric value as progress for this badge
 *       };
 *     `
 * 
 * Note: All historical badges are executed in a single aggregate query using $facet,
 * which allows MongoDB to process all badges in parallel for better performance.
 *   }
 *
 * The placeholder above is just an example; more historical badges can store their
 * own aggregate‑building snippets in `condition` using the same pattern.
 * 
 * Example for "losses against friends" badge (using $lookup to get friends in the aggregate):
 *
 *   {
 *     id: 'losses_against_friends',
 *     name: 'Humble Friend',
 *     requiresHistoricalData: true,
 *     isUnique: false,
 *     type: 'tiered',
 *     tierThresholds: [5, 10, 25],
 *     condition: `
 *       // Build pipeline that uses $lookup to get friends within the aggregate
 *       const facetPipeline = [
 *         // First, lookup friends (both directions: from->to and to->from)
 *         {
 *           $lookup: {
 *             from: 'friends',
 *             let: { playerId: playerIdStr },
 *             pipeline: [
 *               {
 *                 $match: {
 *                   $expr: {
 *                     $and: [
 *                       { $eq: ['$status', 'accepted'] },
 *                       {
 *                         $or: [
 *                           { $eq: [{ $toString: '$from' }, '$$playerId'] },
 *                           { $eq: [{ $toString: '$to' }, '$$playerId'] }
 *                         ]
 *                       }
 *                     ]
 *                   }
 *                 }
 *               },
 *               {
 *                 $project: {
 *                   friendId: {
 *                     $cond: {
 *                       if: { $eq: [{ $toString: '$from' }, '$$playerId'] },
 *                       then: { $toString: '$to' },
 *                       else: { $toString: '$from' }
 *                     }
 *                   }
 *                 }
 *               }
 *             ],
 *             as: 'friends'
 *           }
 *         },
 *         // Extract friend IDs into an array
 *         {
 *           $addFields: {
 *             friendIds: '$friends.friendId'
 *           }
 *         },
 *         // Unwind results to work with individual result entries
 *         { $unwind: '$results' },
 *         // Group by scorecard and player to calculate total scores
 *         {
 *           $group: {
 *             _id: {
 *               scorecardId: '$_id',
 *               playerId: '$results.playerId'
 *             },
 *             totalScore: { $sum: '$results.score' },
 *             scorecardId: { $first: '$_id' },
 *             friendIds: { $first: '$friendIds' }
 *           }
 *         },
 *         // Group by scorecard to get all player scores together
 *         // Note: playerId is ObjectId (from results), friendIds are ObjectIds - no conversion needed
 *         {
 *           $group: {
 *             _id: '$scorecardId',
 *             playerScores: {
 *               $push: {
 *                 playerId: '$_id.playerId', // ObjectId, matches friendIds (ObjectIds)
 *                 totalScore: '$totalScore'
 *               }
 *             },
 *             friendIds: { $first: '$friendIds' }
 *           }
 *         },
 *         // Filter to only scorecards where at least one friend played
 *         {
 *           $match: {
 *             $expr: {
 *               $gt: [
 *                 {
 *                   $size: {
 *                     $setIntersection: ['$playerScores.playerId', '$friendIds']
 *                   }
 *                 },
 *                 0
 *               ]
 *             }
 *           }
 *         },
 *         // Calculate if player lost to any friend
 *         {
 *           $addFields: {
 *             playerScore: {
 *               $let: {
 *                 vars: {
 *                   player: {
 *                     $arrayElemAt: [
 *                       {
 *                         $filter: {
 *                           input: '$playerScores',
 *                           as: 'ps',
 *                           cond: { $eq: ['$$ps.playerId', playerIdObj] } // Use ObjectId
 *                         }
 *                       },
 *                       0
 *                     ]
 *                   }
 *                 },
 *                 in: '$$player.totalScore'
 *               }
 *             },
 *             friendScores: {
 *               $filter: {
 *                 input: '$playerScores',
 *                 as: 'ps',
 *                 cond: {
 *                   $and: [
 *                     { $ne: ['$$ps.playerId', playerIdObj] }, // Use ObjectId
 *                     { $in: ['$$ps.playerId', '$friendIds'] } // Both ObjectIds, no conversion
 *                   ]
 *                 }
 *               }
 *             }
 *           }
 *         },
 *         // Check if player lost (higher score = worse in disc golf)
 *         {
 *           $addFields: {
 *             lost: {
 *               $cond: {
 *                 if: { $gt: [{ $size: '$friendScores' }, 0] },
 *                 then: {
 *                   $gt: [
 *                     '$playerScore',
 *                     { $min: '$friendScores.totalScore' }
 *                   ]
 *                 },
 *                 else: false
 *               }
 *             }
 *           }
 *         },
 *         // Count scorecards where player lost
 *         {
 *           $match: { lost: true }
 *         },
 *         {
 *           $group: {
 *             _id: null,
 *             value: { $sum: 1 }
 *           }
 *         }
 *       ];
 *       
 *       return {
 *         facetPipeline,
 *         valueField: 'value',
 *         asProgress: true
 *       };
 *     `
 *   }
 */
const checkHistoricalBadges = async (db, playerId, historicalBadges, courseId, scorecardId = null) => {
  const scorecardsCollection = db.collection('scorecards');
  const playerIdStr = String(playerId);
  const playerIdObj = ObjectId.isValid(playerIdStr) ? new ObjectId(playerIdStr) : playerIdStr;
  const courseIdStr = courseId ? String(courseId) : null;
  const now = new Date();

  const results = [];

  // Helper: Build aggregate configuration from a historical badge's condition string.
  // The condition string is treated as the body of a function with the following signature:
  //   (playerIdObj, playerIdStr, courseId, courseIdStr, ObjectId, now) => ({
  //      facetPipeline: [...],  // stages to run inside $facet (without shared $match)
  //      valueField: 'value',
  //      asProgress: true|false
  //   })
  const buildHistoricalAggregateFromCondition = (badgeDef) => {
    if (!badgeDef.condition || typeof badgeDef.condition !== 'string') {
      return null;
    }

    let trimmed = badgeDef.condition.trim();
    
    // Handle arrow function syntax: (params) => { ... } or params => { ... }
    const arrowFunctionMatch = trimmed.match(/^\s*(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>\s*\{/);
    if (arrowFunctionMatch) {
      // Extract body from arrow function - find matching outer braces
      let braceCount = 0;
      let functionStart = -1;
      let functionEnd = -1;
      
      // Find the opening brace after the arrow
      const arrowIndex = trimmed.indexOf('=>');
      if (arrowIndex !== -1) {
        for (let i = arrowIndex; i < trimmed.length; i++) {
          if (trimmed[i] === '{') {
            if (braceCount === 0) {
              functionStart = i;
            }
            braceCount++;
          } else if (trimmed[i] === '}') {
            braceCount--;
            if (braceCount === 0 && functionStart !== -1) {
              functionEnd = i;
              break;
            }
          }
        }
      }
      
      if (functionStart !== -1 && functionEnd !== -1) {
        trimmed = trimmed.substring(functionStart + 1, functionEnd).trim();
      }
    } else {
      // Check if it looks like a function declaration: function (...) { ... }
      const functionDeclMatch = trimmed.match(/^\s*function\s*\([^)]*\)\s*\{/);
      if (functionDeclMatch) {
        // Find matching outer braces for function declaration
        let braceCount = 0;
        let functionStart = -1;
        let functionEnd = -1;
        
        const funcIndex = trimmed.indexOf('function');
        if (funcIndex !== -1) {
          for (let i = funcIndex; i < trimmed.length; i++) {
            if (trimmed[i] === '{') {
              if (braceCount === 0) {
                functionStart = i;
              }
              braceCount++;
            } else if (trimmed[i] === '}') {
              braceCount--;
              if (braceCount === 0 && functionStart !== -1) {
                functionEnd = i;
                break;
              }
            }
          }
        }
        
        if (functionStart !== -1 && functionEnd !== -1) {
          trimmed = trimmed.substring(functionStart + 1, functionEnd).trim();
        }
      }
      // Otherwise, treat the entire string as the body (no wrapper)
    }
    
    const body = trimmed;

    try {
      // Debug: log the body being executed

      const fn = new Function(
        'playerIdObj',
        'playerIdStr',
        'courseId',
        'courseIdStr',
        'ObjectId',
        'now',
        body
      );
      const config = fn(playerIdObj, playerIdStr, courseId, courseIdStr, ObjectId, now);

      // Support both 'pipeline' (legacy) and 'facetPipeline' (new)
      const facetPipeline = config.facetPipeline || config.pipeline;
      
      if (!config || !Array.isArray(facetPipeline) || !config.valueField) {
        return null;
      }

      return {
        facetPipeline,
        valueField: config.valueField
      };
    } catch (err) {
      console.error(`Failed to build historical aggregate for badge ${badgeDef.name}:`, err);
      return null;
    }
  };

  // Build configurations for all badges first
  const badgeConfigs = [];
  for (const badgeDef of historicalBadges) {
    const aggConfig = buildHistoricalAggregateFromCondition(badgeDef);
    if (aggConfig) {
      badgeConfigs.push({
        badgeDef,
        aggConfig
      });
    }
  }

  // If no badges have valid configurations, return early
  if (badgeConfigs.length === 0) {
    return results;
  }

  // Build the shared match stage (common to all badges)
  // Note: Both creatorId and results.playerId are stored as ObjectIds
  // Exclude the current scorecard from historical checks
  const sharedMatch = {
    status: 'completed',
    $or: [
      { creatorId: playerIdObj },
      { 'results.playerId': playerIdObj } // results.playerId is ObjectId
    ]
  };

  // Build the $facet stage with one facet per badge
  const facets = {};
  const badgeIdToConfig = {};
  
  for (const { badgeDef, aggConfig } of badgeConfigs) {
    const facetKey = badgeDef.id; // Use badge ID as the facet key
    facets[facetKey] = [
      // Add badge-specific stages after the shared match
      ...aggConfig.facetPipeline
    ];
    badgeIdToConfig[facetKey] = { badgeDef, aggConfig };
  }

  // Build the $project stage to extract values from each facet.
  // Simpler & more robust: we assume each facet outputs documents shaped like { value: <number> }.
  // Then we just take the first document's `value` field or 0 if missing.
  const projectFields = {};
  for (const facetKey of Object.keys(facets)) {
    projectFields[facetKey] = {
      $ifNull: [
        { $arrayElemAt: [`$${facetKey}.value`, 0] },
        0
      ]
    };
  }

  // Build the complete aggregation pipeline
  // 1) Match this player's completed scorecards
  // 2) Lookup friends once (for ALL historical badges)
  // 3) Add shared friendIds field
  // 4) Run all badge-specific facets in parallel
  const pipeline = [
    {
      $match: sharedMatch
    },
    // Lookup accepted friends for this player (both directions)
    // Note: friends.to, friends.from, and results.playerId are all ObjectIds - no conversions needed
    {
      $lookup: {
        from: 'friends',
        let: { playerId: playerIdObj }, // Use ObjectId for comparison
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$status', 'accepted'] },
                  {
                    $or: [
                      { $eq: ['$from', '$$playerId'] }, // Direct ObjectId comparison
                      { $eq: ['$to', '$$playerId'] } // Direct ObjectId comparison
                    ]
                  }
                ]
              }
            }
          },
          {
            $project: {
              _id: 0,
              friendId: {
                $cond: {
                  if: { $eq: ['$from', '$$playerId'] },
                  then: '$to', // Return ObjectId directly
                  else: '$from' // Return ObjectId directly
                }
              }
            }
          }
        ],
        as: 'friends'
      }
    },
    // Expose list of friendIds on every scorecard document so all facets can reuse it
    {
      $addFields: {
        friendIds: '$friends.friendId',
        // Debug: log friend lookup for Friendly Fire debugging
        _debugFriendLookup: {
          playerId: { $toString: playerIdObj },
          friendsFound: { $size: { $ifNull: ['$friends', []] } },
          friendIdsArray: '$friends.friendId'
        }
      }
    },
    {
      $facet: facets
    },
    {
      $project: projectFields
    }
  ];

  try {    
    // Execute single aggregate query for all badges
    const aggResult = await scorecardsCollection.aggregate(pipeline).toArray();
    const resultDoc = aggResult[0] || {};

    // Process results for each badge
    for (const facetKey of Object.keys(facets)) {
      const { badgeDef, aggConfig } = badgeIdToConfig[facetKey];
      const value = resultDoc[facetKey];

      if (value === undefined || value === null || value === 0 || value === false) {
        continue;
      }

      const hasTierThresholds = Array.isArray(badgeDef.tierThresholds) && badgeDef.tierThresholds.length > 0;
      const firstThreshold = hasTierThresholds ? badgeDef.tierThresholds[0] : null;

      if (badgeDef.isUnique && !badgeDef.asProgress && hasTierThresholds) {
        // Treat this as a unique, earned‑once historical badge (no tiers)
        if (typeof value === 'number' && value >= firstThreshold) {
          results.push({
            badgeId: badgeDef.id,
            name: badgeDef.name,
            earned: true,
            courseId: courseId || null,
            layoutId: null
          });
        }
      } else if (badgeDef.isUnique && badgeDef.asProgress && hasTierThresholds) {
        // Unique historical badge that still uses tierThresholds for its condition.
        // When the aggregate value meets at least the first tier, treat it as earned once.
        if (typeof value === 'number' && value >= firstThreshold) {
          results.push({
            badgeId: badgeDef.id,
            name: badgeDef.name,
            earned: true,
            courseId: courseId || null,
            layoutId: null
          });
        }

        // Also expose the numeric value as progress for debugging / UI if desired.
        results.push({
          badgeId: badgeDef.id,
          name: badgeDef.name,
          progress: value,
          courseId: courseId || null,
          layoutId: null
        });
      } else {
        // Treat this as progressive – use the aggregate value as progress
        results.push({
          badgeId: badgeDef.id,
          name: badgeDef.name,
          progress: value,
          courseId: courseId || null,
          layoutId: null
        });
      }
    }

  } catch (error) {
    console.error(`\n❌ [checkHistoricalBadges] Error executing historical badges aggregate:`, error);
    console.error(`   Error stack:`, error.stack);
    // Fallback: try individual badges if the combined query fails
    for (const { badgeDef, aggConfig } of badgeConfigs) {
      try {
        const fallbackPipeline = [
          { $match: sharedMatch },
          ...aggConfig.facetPipeline
        ];
        const fallbackResult = await scorecardsCollection.aggregate(fallbackPipeline).toArray();
        const firstDoc = fallbackResult[0] || {};
        const value = firstDoc[aggConfig.valueField];

        if (value !== undefined && value !== null && value !== 0 && value !== false) {
          const hasTierThresholds =
            Array.isArray(badgeDef.tierThresholds) && badgeDef.tierThresholds.length > 0;
          const firstThreshold = hasTierThresholds ? badgeDef.tierThresholds[0] : null;

          if (badgeDef.isUnique && !badgeDef.asProgress && hasTierThresholds) {
            if (typeof value === 'number' && value >= firstThreshold) {
              results.push({
                badgeId: badgeDef.id,
                name: badgeDef.name,
                earned: true,
                courseId: courseId || null,
                layoutId: null
              });
            }
          } else if (badgeDef.isUnique && !badgeDef.asProgress) {
            results.push({
              badgeId: badgeDef.id,
              name: badgeDef.name,
              earned: true,
              courseId: courseId || null,
              layoutId: null
            });
          } else if (badgeDef.isUnique && badgeDef.asProgress && hasTierThresholds) {
            if (typeof value === 'number' && value >= firstThreshold) {
              results.push({
                badgeId: badgeDef.id,
                name: badgeDef.name,
                earned: true,
                courseId: courseId || null,
                layoutId: null
              });
            }

            results.push({
              badgeId: badgeDef.id,
              name: badgeDef.name,
              progress: value,
              courseId: courseId || null,
              layoutId: null
            });
          } else {
            results.push({
              badgeId: badgeDef.id,
              name: badgeDef.name,
              progress: value,
              courseId: courseId || null,
              layoutId: null
            });
          }
        }
      } catch (fallbackError) {
        console.error(`Error checking historical badge ${badgeDef.name} (fallback):`, fallbackError);
      }
    }
  }

  return results;
};

// Execute badge condition function
const executeBadgeCondition = (badgeDef, playerResults, layout, { allOtherPlayersResults }) => {

  if (!badgeDef.condition) return false;
  
  try {
    if (typeof badgeDef.condition === 'string') {

      const trimmed = badgeDef.condition.trim();
      const functionStart = trimmed.indexOf('{');
      const functionEnd = trimmed.lastIndexOf('}');
      
      if (functionStart !== -1 && functionEnd !== -1) {
        const functionBody = trimmed.substring(functionStart + 1, functionEnd).trim();
        
        const func = new Function('results', 'layout', 'allOtherPlayersResults', functionBody);
        const result = func(playerResults, layout, allOtherPlayersResults);
        return result;
      } else {
        console.error('Invalid function format in condition');
        return false;
      }
    }
    
    if (typeof badgeDef.condition === 'function') {
      return badgeDef.condition(playerResults, layout, allOtherPlayersResults);
    }
    
    return false;
  } catch (error) {
    console.error(`Error executing condition for ${badgeDef.name}:`, error);
    return false;
  }
};

const updateBadgeProgress = (userId, progressForPlayer, badgeDefinitions, courseId, layoutId, scorecardId, existingProgressMap = {}, badgeTierStatsMap = {}, uniqueBadgeStatsMap = {}) => {
  if (!progressForPlayer || progressForPlayer.length === 0) return { bulkOps: [], badgeObjects: [] };

  // Build bulk write operations for all badges
  const bulkOps = [];
  const badgeObjects = [];

  for (const progressData of progressForPlayer) {
    const badgeDef = badgeDefinitions.find(b => b.id === progressData.badgeId);
    if (!badgeDef || !badgeDef.tierThresholds) continue;
    
    // Get existing progress values
    const existing = existingProgressMap[progressData.badgeId] || { currentTier: -1, totalProgress: 0 };
    
    // Calculate new totalProgress (same logic as MongoDB pipeline)
    // trackTierThresholdZync: true -> Points cannot be accumulated. Tier only levels up if you get
    //   the points needed during ONE round. totalProgress = current round's progress only.
    // trackTierThresholdZync: false -> Points accumulate across rounds. totalProgress accumulates.
    const newTotalProgress = badgeDef.trackTierThresholdZync
      ? progressData.progress
      : existing.totalProgress + progressData.progress;
    
    // Calculate new tier based on totalProgress
    // For trackTierThresholdZync: true, this checks if current round's progress meets a threshold
    // For trackTierThresholdZync: false, this checks if accumulated progress meets a threshold
    const newTier = calculateCurrentTier(newTotalProgress, badgeDef.tierThresholds);
    const newCurrentTier = Math.max(existing.currentTier, newTier);

    // Build aggregation pipeline for update that handles both insert and update cases
    // Calculate new totalProgress in MongoDB pipeline (same logic as in-memory calculation above)
    // trackTierThresholdZync: true -> Set totalProgress to current round's progress (no accumulation)
    // trackTierThresholdZync: false -> Add current round's progress to existing totalProgress (accumulation)
    const totalProgressUpdate = badgeDef.trackTierThresholdZync
      ? progressData.progress
      : { $add: [{ $ifNull: ['$totalProgress', 0] }, progressData.progress] };

    // Build tier calculation pipeline - iterate through thresholds from highest to lowest
    const tierCalculation = buildTierCalculationPipeline(badgeDef.tierThresholds);

    // Build the update pipeline
    const pipeline = [
      {
        $set: {
          // Capture oldCurrentTier BEFORE updating totalProgress to ensure we compare against previous tier
          oldCurrentTier: { $ifNull: ['$currentTier', -1] },
          totalProgress: totalProgressUpdate,
          lastUpdated: new Date(),
          badgeName: badgeDef.name,
          isUnique: badgeDef.isUnique === true
        }
      },
      {
        $set: {
          newTier: tierCalculation
        }
      },
      {
        $set: {
          currentTier: { $max: ['$oldCurrentTier', '$newTier'] }
        }
      },
      {
        $set: {
          completedCourses: badgeDef.trackUniqueCourses
            ? { $setUnion: [{ $ifNull: ['$completedCourses', []] }, [courseId]] }
            : { $ifNull: ['$completedCourses', []] }
        }
      },
      {
        $set: {
          // trackedThresholds: For badges with trackTierThresholdZync: true, track which tier thresholds
          // have been achieved. Only add tiers >= 0 (actual achieved tiers, not -1).
          trackedThresholds: badgeDef.trackTierThresholdZync
            ? {
                $cond: {
                  if: { $gte: ['$newTier', 0] },
                  then: { $setUnion: [{ $ifNull: ['$trackedThresholds', []] }, ['$newTier']] },
                  else: { $ifNull: ['$trackedThresholds', []] }
                }
              }
            : { $ifNull: ['$trackedThresholds', []] }
        }
      },
      {
        $set: {
          tierProgress: {
            $cond: {
              if: { $gt: ['$newTier', '$oldCurrentTier'] },
              then: {
                $concatArrays: [
                  { $ifNull: ['$tierProgress', []] },
                  [{
                    tierIndex: '$newTier',
                    achieved: true,
                    achievedDate: new Date(),
                    courseId: courseId,
                    layoutId: layoutId,
                    progress: progressData.progress,
                    scorecardId: scorecardId
                  }]
                ]
              },
              else: { $ifNull: ['$tierProgress', []] }
            }
          }
        }
      },
      {
        $unset: 'newTier'
      },
      {
        $unset: 'oldCurrentTier'
      }
    ];

    // Always target exactly one progress document per user+badge.
    const query = { userId: userId, badgeId: badgeDef.id };

    // For unique-course badges, do not increment if this course already counted.
    if (badgeDef.trackUniqueCourses) {
      const existingCompletedCourses = Array.isArray(existing.completedCourses)
        ? existing.completedCourses
        : [];
      const hasCourseAlready =
        existingCompletedCourses.some((c) => String(c) === String(courseId));
      if (hasCourseAlready) {
        continue;
      }
    }

    // Set default values on insert
    const setOnInsert = {
      userId: userId,
      badgeId: badgeDef.id,
      badgeName: badgeDef.name,
      isUnique: badgeDef.isUnique === true,
      currentTier: -1,
      totalProgress: 0,
      completedCourses: [],
      trackedThresholds: [],
      tierProgress: []
    };

    // Compile badge object for scorecard update (with currentTier and totalProgress)
    let userPercentage = null;

    if (badgeDef.isUnique === true) {
      // For unique badges, use global unique-badge statistics (percentage of users who have earned it)
      const uniqueStats = uniqueBadgeStatsMap[badgeDef.id];
      if (uniqueStats && typeof uniqueStats.percentage === 'number') {
        userPercentage = uniqueStats.percentage;
      }
    } else {
      // For tiered, non-unique badges, use per-tier statistics
      const statsForBadge = badgeTierStatsMap[badgeDef.id] || null;
      if (statsForBadge && Array.isArray(statsForBadge.tiers)) {
        const tierInfo = statsForBadge.tiers.find(t => t.tierIndex === newCurrentTier);
        if (tierInfo) {
          userPercentage = tierInfo.percentage;
        }
      }
    }

    const badgeObject = {
      badgeId: progressData.badgeId,
      badgeName: progressData.badgeName,
      progress: progressData.progress,
      courseId: progressData.courseId,
      layoutId: progressData.layoutId,
      tierThresholds: badgeDef.tierThresholds,
      description: badgeDef.description,
      tierDescriptionPrefix: badgeDef.tierDescriptionPrefix,
      tierDescriptionSuffix: badgeDef.tierDescriptionSuffix,
      tierIncremented: newCurrentTier > existing.currentTier,
      currentTier: newCurrentTier,
      previousTotalProgress: existing.totalProgress,
      totalProgress: newTotalProgress,
      isUnique: badgeDef.isUnique,
      userPercentage
    };
    badgeObjects.push(badgeObject);

    bulkOps.push({
      updateOne: {
        filter: query,
        update: pipeline,
        upsert: true,
        setOnInsert: setOnInsert
      }
    });
  }

  return { bulkOps, badgeObjects };
};

/**
 * Stamp each new tierProgress row with XP granted for that badge this round
 * (aligned 1:1 with updateBadgeProgress bulk ops and badgeObjectsWithXP).
 */
const addPerBadgeXpToTierProgressOps = (ops, badgeObjectsWithXP) => {
  if (!Array.isArray(ops) || !Array.isArray(badgeObjectsWithXP)) return;

  for (let i = 0; i < ops.length; i++) {
    const xpForBadge = Number(badgeObjectsWithXP[i]?.xp) || 0;
    const pipeline = ops[i]?.updateOne?.update;
    if (!Array.isArray(pipeline)) continue;

    for (const stage of pipeline) {
      const newTierProgressEntry = stage?.$set?.tierProgress?.$cond?.then?.$concatArrays?.[1]?.[0];
      if (newTierProgressEntry && typeof newTierProgressEntry === 'object') {
        newTierProgressEntry.xp = xpForBadge;
      }
    }
  }
};

// Build tier calculation pipeline that finds the highest tier threshold met
const buildTierCalculationPipeline = (thresholds) => {
  // Build a series of $cond expressions to find the highest tier
  // We check each threshold and use $max to keep the highest tier that matches
  // This ensures that if multiple thresholds are met, we get the highest one
  
  // Start with -1 (no tier)
  let tierCalculation = -1;
  
  // Build nested $cond expressions: for each threshold, if progress >= threshold[i],
  // use $max to keep the higher of current tier or i
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (i === thresholds.length - 1) {
      // First iteration - base case
      tierCalculation = {
        $cond: [
          { $gte: ['$totalProgress', thresholds[i]] },
          i,
          -1
        ]
      };
    } else {
      // Subsequent iterations - use $max to keep the highest tier
      tierCalculation = {
        $cond: [
          { $gte: ['$totalProgress', thresholds[i]] },
          { $max: [tierCalculation, i] }, // Keep the higher tier
          tierCalculation // Keep current tier if threshold not met
        ]
      };
    }
  }
  
  return tierCalculation;
};

// Calculate current tier based on progress
const calculateCurrentTier = (progress, thresholds) => {
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (progress >= thresholds[i]) {
      return i;
    }
  }
  return -1; // No tier achieved yet
};

// Check if a specific tier was reached for a user's badge progress
const checkTierAchievement = async (userId, badgeId, targetTierIndex) => {
  const db = getDatabase();
  const progressCollection = db.collection('userBadgeProgress');
  
  try {
    // Get the user's progress for this specific badge
    const userProgress = await progressCollection.findOne({
      userId: userId,
      badgeId: badgeId
    });
    
    if (!userProgress) {
      return {
        achieved: false,
        currentTier: -1,
        totalProgress: 0,
        tierInfo: null
      };
    }
    
    // Check if the target tier was achieved
    const achieved = userProgress.currentTier >= targetTierIndex;
    
    // Get tier information if available
    let tierInfo = null;
    if (userProgress.tierProgress && userProgress.tierProgress.length > 0) {
      // Find the tier info for the target tier or the highest achieved tier
      tierInfo = userProgress.tierProgress.find(tier => tier.tierIndex === targetTierIndex);
      if (!tierInfo && achieved) {
        // If target tier is achieved but not in tierProgress, get the current tier info
        tierInfo = userProgress.tierProgress[0]; // Current tier is always the first (and only) entry
      }
    }
    
    return {
      achieved: achieved,
      currentTier: userProgress.currentTier,
      totalProgress: userProgress.totalProgress,
      tierInfo: tierInfo,
      lastUpdated: userProgress.lastUpdated
    };
    
  } catch (error) {
    console.error(`Error checking tier achievement for user ${userId}, badge ${badgeId}:`, error);
    return {
      achieved: false,
      currentTier: -1,
      totalProgress: 0,
      tierInfo: null,
      error: error.message
    };
  }
};

// Get all tier achievements for a user's badge
const getUserBadgeTierAchievements = async (userId, badgeId) => {
  const db = getDatabase();
  const progressCollection = db.collection('userBadgeProgress');
  
  try {
    const userProgress = await progressCollection.findOne({
      userId: userId,
      badgeId: badgeId
    });
    
    if (!userProgress) {
      return {
        currentTier: -1,
        totalProgress: 0,
        tierInfo: null,
        allTiersAchieved: []
      };
    }
    
    // Get badge definitions to know all possible tiers
    const badgeDefinitions = await getBadgeDefinitions(db);
    const badgeDef = badgeDefinitions.find(b => b.id === badgeId);
    
    if (!badgeDef || !badgeDef.tierThresholds) {
      return {
        currentTier: userProgress.currentTier,
        totalProgress: userProgress.totalProgress,
        tierInfo: userProgress.tierProgress?.[0] || null,
        allTiersAchieved: []
      };
    }
    
    // Calculate which tiers have been achieved
    const allTiersAchieved = [];
    for (let i = 0; i < badgeDef.tierThresholds.length; i++) {
      if (userProgress.currentTier >= i) {
        allTiersAchieved.push({
          tierIndex: i,
          threshold: badgeDef.tierThresholds[i],
          achieved: true,
          achievedDate: userProgress.tierProgress?.[0]?.achievedDate || userProgress.lastUpdated
        });
      }
    }
    
    return {
      currentTier: userProgress.currentTier,
      totalProgress: userProgress.totalProgress,
      tierInfo: userProgress.tierProgress?.[0] || null,
      allTiersAchieved: allTiersAchieved,
      lastUpdated: userProgress.lastUpdated
    };
    
  } catch (error) {
    console.error(`Error getting tier achievements for user ${userId}, badge ${badgeId}:`, error);
    return {
      currentTier: -1,
      totalProgress: 0,
      tierInfo: null,
      allTiersAchieved: [],
      error: error.message
    };
  }
};

const getUserAllBadges = async (userId) => {
  const db = getDatabase();
  const badgesCollection = db.collection('userBadgeProgress');
  
  const result = await badgesCollection.aggregate([
    { $match: { userId: userId } },
    {
      $group: {
        _id: "$badgeId",
        doc: { $first: "$$ROOT" } // Take first document if duplicates exist
      }
    },
    { $replaceRoot: { newRoot: "$doc" } }, // Restore document structure
    {
      $lookup: {
        from: "badgeDefinitions",
        localField: "badgeId",
        foreignField: "id",
        as: "badgeDef"
      }
    },
    {
      $addFields: {
        badgeDef: { $arrayElemAt: ["$badgeDef", 0] }
      }
    },
    // Filter out documents where badgeDef lookup failed (badge definition doesn't exist)
    { $match: { badgeDef: { $ne: null } } },
    {
      $project: {
        userId: 1,
        badgeId: 1,
        currentTier: 1,
        totalProgress: 1,
        tierProgress: 1,
        lastUpdated: 1,
        badgeName: 1,
        tierPoints: "$badgeDef.tierPoints",
        tierNames: "$badgeDef.tierNames",
        quote: "$badgeDef.quote",
        description: "$badgeDef.description",
        tierDescriptionPrefix: "$badgeDef.tierDescriptionPrefix",
        tierDescriptionSuffix: "$badgeDef.tierDescriptionSuffix",
        tierThresholds: "$badgeDef.tierThresholds",
        type: "$badgeDef.type",
        isUnique: "$badgeDef.isUnique",
        trackUniqueCourses: "$badgeDef.trackUniqueCourses",
        difficulty: "$badgeDef.difficulty",
        animation: "$badgeDef.animation"
      }
    }
  ]).toArray();
  return result;
};

// Get percentage of users that have reached each tier for a specific badge
const getBadgeTierPercentages = async (badgeId) => {
  const db = getDatabase();
  const progressCollection = db.collection('userBadgeProgress');

  try {
    // Get badge definition to know tier thresholds
    const badgeDefinitions = await getBadgeDefinitions(db);
    const badgeDef = badgeDefinitions.find(b => b.id === badgeId);

    if (!badgeDef || !Array.isArray(badgeDef.tierThresholds) || badgeDef.tierThresholds.length === 0) {
      return {
        badgeId,
        totalUsers: 0,
        tiers: []
      };
    }

    // Aggregate users and their current tier for this badge
    const agg = await progressCollection.aggregate([
      { $match: { badgeId } },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          tiers: { $push: '$currentTier' }
        }
      }
    ]).toArray();

    if (!agg.length || !agg[0].totalUsers) {
      return {
        badgeId,
        totalUsers: 0,
        tiers: badgeDef.tierThresholds.map((threshold, tierIndex) => ({
          tierIndex,
          threshold,
          count: 0,
          percentage: 0
        }))
      };
    }

    const { totalUsers, tiers } = agg[0];

    // For each tier index, count how many users have currentTier >= that index
    const tierStats = badgeDef.tierThresholds.map((threshold, tierIndex) => {
      const count = tiers.filter(tier => typeof tier === 'number' && tier >= tierIndex).length;
      const percentage = totalUsers > 0 ? (count / totalUsers) * 100 : 0;
      return {
        tierIndex,
        threshold,
        count,
        percentage
      };
    });

    return {
      badgeId,
      totalUsers,
      tiers: tierStats
    };
  } catch (error) {
    console.error(`Error calculating tier percentages for badge ${badgeId}:`, error);
    return {
      badgeId,
      totalUsers: 0,
      tiers: [],
      error: error.message
    };
  }
};

const fetchEarnedBadgesAndAchievementsForScorecard = async ({ scorecardId, results, courseId, layout, scorecard }) => {
  const db = getDatabase();
  const badgesCollection = db.collection('userBadgeProgress');
  const achievementProgressCollection = db.collection('userAchievementProgress');
  const scorecardObjectId = new ObjectId(scorecardId);

  // get userBadgeProgress where userBadgeProgress.scorecardId = scorecardId OR userBadgeProgress.tierProgress.scorecardId = scorecardId
  // and enrich each doc with userPercentage: % of users (globally) that earned that badge

  [badgeProgressDocs, achievementProgressDocs] = await Promise.all([
    badgesCollection.aggregate([
      {
        $match: {
          $or: [
            { scorecardId: scorecardObjectId },
            { 'tierProgress.scorecardId': scorecardObjectId }
          ]
        }
      },
      {
        $lookup: {
          from: 'userBadgeProgress',
          let: { bid: '$badgeId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$badgeId', '$$bid'] } } },
            // Dedupe by user so each user counts at most once per badge
            {
              $group: {
                _id: '$userId',
                currentTier: { $max: { $ifNull: ['$currentTier', -1] } },
                totalProgress: { $max: { $ifNull: ['$totalProgress', 0] } }
              }
            },
            {
              $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                holders: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $gte: ['$currentTier', 0] },
                          { $gt: ['$totalProgress', 0] }
                        ]
                      },
                      1,
                      0
                    ]
                  }
                }
              }
            },
            {
              $project: {
                _id: 0,
                userPercentage: {
                  $cond: [
                    { $gt: ['$totalUsers', 0] },
                    { $multiply: [{ $divide: ['$holders', '$totalUsers'] }, 100] },
                    0
                  ]
                }
              }
            }
          ],
          as: 'badgeStats'
        }
      },
      {
        $addFields: {
          userPercentage: {
            $ifNull: [{ $arrayElemAt: ['$badgeStats.userPercentage', 0] }, 0]
          }
        }
      },
      { $project: { badgeStats: 0 } }
    ]).toArray(),
    achievementProgressCollection.aggregate([
      {
        $match: {
          scorecardIds: scorecardObjectId
        }
      },
      {
        $lookup: {
          from: 'userAchievementProgress',
          let: { aid: '$achievementId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$achievementId', '$$aid'] } } },
            // Dedupe by user so each user counts at most once per achievement
            {
              $group: {
                _id: '$userId',
                won: { $max: { $cond: [{ $eq: ['$won', true] }, 1, 0] } },
                progress: { $max: { $ifNull: ['$progress', 0] } }
              }
            },
            {
              $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                holders: { $sum: '$won' }
              }
            },
            {
              $project: {
                _id: 0,
                userPercentage: {
                  $cond: [
                    { $gt: ['$totalUsers', 0] },
                    { $multiply: [{ $divide: ['$holders', '$totalUsers'] }, 100] },
                    0
                  ]
                }
              }
            }
          ],
          as: 'achievementStats'
        }
      },
      {
        $addFields: {
          userPercentage: {
            $ifNull: [{ $arrayElemAt: ['$achievementStats.userPercentage', 0] }, 0]
          }
        }
      },
      { $project: { achievementStats: 0 } }
    ]).toArray()
  ]);

  const badgeDefinitions = await getBadgeDefinitions(db);
  const badgeDefById = new Map(
    badgeDefinitions.map((def) => [String(def.id), def])
  );
  const badges = badgeProgressDocs.map((badge) => {
    const def = badgeDefById.get(String(badge.badgeId));
    return {
      ...badge,
      tierThresholds: Array.isArray(def?.tierThresholds) ? def.tierThresholds : null,
      tierDescriptionPrefix: def.tierDescriptionPrefix,
      tierDescriptionSuffix: def.tierDescriptionSuffix
    };
  });

  const badgesByEntity = badges.reduce((acc, badge) => {
    const entityId = badge.userId?.toString?.() ?? String(badge.userId);
    if (!acc[entityId]) {
      acc[entityId] = [];
    }
    const tierProgress = Array.isArray(badge.tierProgress) ? badge.tierProgress : [];
    const xp = tierProgress.length > 0 ? tierProgress[tierProgress.length - 1].xp : badge.totalXP;
    acc[entityId].push({
      ...badge,
      xp: xp
    });
    return acc;
  }, {});

  const achievementsByEntity = achievementProgressDocs.reduce((acc, ach) => {
    const entityId = ach.userId?.toString?.() ?? String(ach.userId);
    if (!acc[entityId]) {
      acc[entityId] = [];
    }
    acc[entityId].push({
      ...ach,
      xp: ach.xpEarned
    });
    return acc;
  }, {});

  const allEntityIds = new Set([
    ...Object.keys(badgesByEntity),
    ...Object.keys(achievementsByEntity)
  ]);

  const badgesPerPLayer = Array.from(allEntityIds).map((entityId) => ({
    entityId,
    badges: badgesByEntity[entityId] || []
  }));

  const achievementsPerPLayer = Array.from(allEntityIds).map((entityId) => ({
    entityId,
    achievements: achievementsByEntity[entityId] || []
  }));

  return [badgesPerPLayer, achievementsPerPLayer];
};

module.exports = { 
  searchForEarnedAchievements,
  searchForEarnedBadges, 
  checkTierAchievement, 
  getUserBadgeTierAchievements,
  getUserAllBadges,
  getBadgeTierPercentages,
  fetchEarnedBadgesAndAchievementsForScorecard,
  checkHistoricalBadges // Export for testing
};