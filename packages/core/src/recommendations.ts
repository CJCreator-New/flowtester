import type {
  AspectType,
  Finding,
  FindingSeverity,
  RankedRecommendation,
} from '@qa/types';
import { ASPECT_CHECKERS } from './scoring.js';

interface EffortImpactMapping {
  category: 'quick-win' | 'bigger-change';
  effort: 'Low' | 'Medium' | 'High';
  impact: 'Low' | 'Medium' | 'High';
  suggestedFix: string;
}

const EFFORT_MULTIPLIERS = {
  Low: 1.5, // prioritize quick wins with high return
  Medium: 1.0,
  High: 0.7,
};

const SEVERITY_WEIGHTS: Record<FindingSeverity, number> = {
  Blocker: 40,
  Major: 25,
  Minor: 10,
  Suggestion: 3,
};

function classifyFinding(finding: Finding): EffortImpactMapping {
  const title = finding.title.toLowerCase();

  // Quick wins: headers, metadata, simple attributes, cookie flags, small fixes
  if (
    title.includes('header') ||
    title.includes('meta description') ||
    title.includes('title tag') ||
    title.includes('lang attribute') ||
    title.includes('cookie') ||
    title.includes('opengraph') ||
    title.includes('touch') ||
    title.includes('alt')
  ) {
    return {
      category: 'quick-win',
      effort: 'Low',
      impact: finding.severity === 'Major' || finding.severity === 'Blocker' ? 'High' : 'Medium',
      suggestedFix: finding.resolution,
    };
  }

  // Bigger changes: form restructuring, responsive refactors, slow performance, overlapping controls
  if (
    title.includes('form sends passwords') ||
    title.includes('overflows the screen') ||
    title.includes('overlap') ||
    title.includes('largest contentful paint') ||
    title.includes('broken link') ||
    title.includes('dead end')
  ) {
    return {
      category: 'bigger-change',
      effort: 'Medium',
      impact: 'High',
      suggestedFix: finding.resolution,
    };
  }

  // Default mapping
  const isHighSeverity = finding.severity === 'Blocker' || finding.severity === 'Major';
  return {
    category: isHighSeverity ? 'bigger-change' : 'quick-win',
    effort: isHighSeverity ? 'Medium' : 'Low',
    impact: isHighSeverity ? 'High' : 'Medium',
    suggestedFix: finding.resolution,
  };
}

function findAspectForChecker(checker: Finding['checker']): AspectType {
  for (const [aspect, checkers] of Object.entries(ASPECT_CHECKERS)) {
    if (checkers.includes(checker)) {
      return aspect as AspectType;
    }
  }
  return 'Works';
}

/**
 * Groups findings into ranked recommendations split into Quick Wins and Bigger Changes.
 * Deterministic ranking formula: Severity Weight * min(Affected Pages, 5) * Effort Multiplier.
 */
export function generateRankedRecommendations(findings: Finding[]): RankedRecommendation[] {
  const activeFindings = findings.filter(
    (f) => !f.needsConfirmation && f.triageStatus !== 'False Positive' && f.triageStatus !== 'Intended'
  );

  // Group by title/resolution to consolidate multi-page occurrences into a single actionable recommendation
  const grouped = new Map<
    string,
    {
      title: string;
      aspect: AspectType;
      severity: FindingSeverity;
      pages: Set<string>;
      findingIds: string[];
      screenshotPath?: string;
      summary: string;
      classification: EffortImpactMapping;
    }
  >();

  for (const f of activeFindings) {
    const key = f.title;
    if (!grouped.has(key)) {
      const aspect = findAspectForChecker(f.checker);
      const classification = classifyFinding(f);
      grouped.set(key, {
        title: f.title,
        aspect,
        severity: f.severity,
        pages: new Set([f.where.urlPath]),
        findingIds: [f.id],
        screenshotPath: f.evidence?.screenshotPath,
        summary: f.expectedVsActual?.actual || f.title,
        classification,
      });
    } else {
      const entry = grouped.get(key)!;
      entry.pages.add(f.where.urlPath);
      entry.findingIds.push(f.id);
      if (!entry.screenshotPath && f.evidence?.screenshotPath) {
        entry.screenshotPath = f.evidence.screenshotPath;
      }
    }
  }

  const recommendations: Array<RankedRecommendation & { score: number }> = [];
  let index = 1;

  for (const [, item] of grouped.entries()) {
    const sevWeight = SEVERITY_WEIGHTS[item.severity] || 10;
    const spread = Math.min(item.pages.size, 5);
    const effortMult = EFFORT_MULTIPLIERS[item.classification.effort] || 1.0;
    const rankScore = Math.round(sevWeight * spread * effortMult);

    recommendations.push({
      id: `REC-${String(index++).padStart(3, '0')}`,
      category: item.classification.category,
      title: item.title,
      aspect: item.aspect,
      severity: item.severity,
      effort: item.classification.effort,
      impact: item.classification.impact,
      affectedPages: Array.from(item.pages),
      findingIds: item.findingIds,
      screenshotPath: item.screenshotPath,
      summary: item.summary,
      suggestedFix: item.classification.suggestedFix,
      score: rankScore,
    });
  }

  // Sort descending by rank score
  recommendations.sort((a, b) => b.score - a.score);

  return recommendations.map(({ score, ...rec }) => rec);
}
