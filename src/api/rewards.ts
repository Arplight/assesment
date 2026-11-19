import api from "../utils/api";

export type DurationUnit = "days" | "years";
export type CompoundingFrequency = "daily" | "weekly" | "monthly" | "annually";

export interface CalculateRewardsRequest {
  principal: number;
  apy: number;
  duration: number;
  durationUnit: DurationUnit;
  compoundingFrequency: CompoundingFrequency;
  tokenPrice?: number;
  chartPoints?: number;
}

export interface ChartPoint {
  index: number;
  yearFraction: number;
  day: number;
  balance: number;
}

export interface CalculateRewardsResult {
  principal: number;
  apy: number;
  duration: number;
  durationUnit: DurationUnit;
  durationYears: number;
  compoundingFrequency: CompoundingFrequency;
  compoundingPeriodsPerYear: number;
  projectedBalance: number;
  totalRewards: number;
  chartData: ChartPoint[];
  tokenPrice?: number;
  projectedBalanceUsd?: number;
  totalRewardsUsd?: number;
  assumptions: {
    rateModel: string;
    formula: string;
    note: string;
  };
}

export async function calculateRewards(
  payload: CalculateRewardsRequest
): Promise<CalculateRewardsResult> {
  try {
    const res = await api.post("/api/calculate-rewards", payload);
    if (!res?.success || !res?.data) {
      throw new Error(res?.message || "Calculation failed");
    }
    return res.data as CalculateRewardsResult;
  } catch (err: any) {
    if (err?.message === "Network Error") {
      throw new Error(
        "Unable to reach the calculation service. Check your connection and try again."
      );
    }
    const message = err?.message || err?.error || "Calculation failed";
    throw new Error(typeof message === "string" ? message : "Calculation failed");
  }
}
