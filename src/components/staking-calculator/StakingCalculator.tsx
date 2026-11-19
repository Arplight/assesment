import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormHelperText,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  calculateRewards,
  CalculateRewardsResult,
  CompoundingFrequency,
  DurationUnit,
} from "../../api/rewards";

type FormState = {
  principal: string;
  apy: string;
  duration: string;
  durationUnit: DurationUnit;
  compoundingFrequency: CompoundingFrequency;
  tokenPrice: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

type UiStatus = "idle" | "loading" | "success" | "error";

const initialForm: FormState = {
  principal: "1000",
  apy: "5",
  duration: "365",
  durationUnit: "days",
  compoundingFrequency: "daily",
  tokenPrice: "",
};

function formatNumber(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function validateForm(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const principal = Number(form.principal);
  const apy = Number(form.apy);
  const duration = Number(form.duration);

  if (!form.principal.trim() || !Number.isFinite(principal) || principal <= 0) {
    errors.principal = "Enter a principal greater than 0";
  } else if (principal > 1e15) {
    errors.principal = "Principal must be 1e15 or less";
  }
  if (!form.apy.trim() || !Number.isFinite(apy) || apy < 0 || apy > 1000) {
    errors.apy = "APY must be between 0 and 1000";
  }
  if (!form.duration.trim() || !Number.isFinite(duration) || duration <= 0) {
    errors.duration = "Duration must be greater than 0";
  }
  if (form.tokenPrice.trim()) {
    const price = Number(form.tokenPrice);
    if (!Number.isFinite(price) || price < 0) {
      errors.tokenPrice = "Token price must be 0 or greater";
    }
  }
  return errors;
}

const StakingCalculator: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isNarrow = useMediaQuery(theme.breakpoints.down("sm"));

  const [form, setForm] = useState<FormState>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<UiStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [result, setResult] = useState<CalculateRewardsResult | null>(null);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);

  const chartSeries = useMemo(() => {
    if (!result?.chartData?.length) return [];
    // Thin labels on small screens to avoid axis clutter / overflow.
    const step = isNarrow ? 8 : isMobile ? 4 : 1;
    return result.chartData.map((p, idx) => ({
      label:
        idx % step === 0 || idx === result.chartData.length - 1
          ? result.durationUnit === "days"
            ? `${Math.round(p.day)}d`
            : `${p.yearFraction.toFixed(2)}y`
          : "",
      balance: p.balance,
      day: p.day,
      yearFraction: p.yearFraction,
    }));
  }, [result, isMobile, isNarrow]);

  const handleChange =
    (field: keyof FormState) =>
    (
      event:
        | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
        | { target: { value: unknown } }
    ) => {
      const value = String(event.target.value);
      setForm((prev) => ({ ...prev, [field]: value }));
      setFieldErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
      if (status === "error") {
        setErrorMessage("");
        setStatus(result ? "success" : "idle");
      }
    };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // The disabled button only takes effect after re-render; block same-tick resubmits.
    if (inFlightRef.current) return;
    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setStatus("error");
      setErrorMessage("Please fix the highlighted fields.");
      return;
    }

    const requestId = ++requestIdRef.current;
    inFlightRef.current = true;
    setStatus("loading");
    setErrorMessage("");

    try {
      const payload = {
        principal: Number(form.principal),
        apy: Number(form.apy),
        duration: Number(form.duration),
        durationUnit: form.durationUnit,
        compoundingFrequency: form.compoundingFrequency,
        ...(form.tokenPrice.trim()
          ? { tokenPrice: Number(form.tokenPrice) }
          : {}),
      };
      const data = await calculateRewards(payload);
      if (requestId !== requestIdRef.current) return; // stale response
      setResult(data);
      setStatus("success");
    } catch (err: any) {
      if (requestId !== requestIdRef.current) return;
      const message =
        err?.message ||
        (typeof err === "string" ? err : null) ||
        "Unable to calculate rewards. Please try again.";
      setStatus("error");
      setErrorMessage(message);
    } finally {
      inFlightRef.current = false;
    }
  };

  const accent = "#00dbe3";
  const navy = "#173039";

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
        backgroundColor: theme.palette.mode === "dark" ? "#0f1c22" : "#fff",
        borderRadius: "8px",
        border: `2px solid ${accent}`,
        padding: { xs: "16px 12px", sm: "20px 16px", md: "32px 28px" },
        textAlign: "left",
      }}
    >
      <Typography
        sx={{
          fontSize: { xs: "22px", sm: "28px", md: "36px" },
          lineHeight: 1.2,
          fontWeight: 700,
          color: theme.palette.mode === "dark" ? "#fff" : navy,
          mb: 1,
          wordBreak: "break-word",
        }}
      >
        Staking Rewards Calculator
      </Typography>
      <Typography
        sx={{
          color: theme.palette.text.secondary,
          mb: 3,
          maxWidth: 720,
          fontSize: { xs: "14px", md: "16px" },
        }}
      >
        Project compounded staking returns from principal, APY, duration, and
        compounding frequency. Optional token price adds USD projections.
      </Typography>

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Grid container spacing={{ xs: 1.5, sm: 2 }}>
          <Grid item xs={12} sm={6} md={4} sx={{ minWidth: 0 }}>
            <TextField
              fullWidth
              label="Principal"
              value={form.principal}
              onChange={handleChange("principal")}
              error={Boolean(fieldErrors.principal)}
              helperText={fieldErrors.principal || "Amount to stake"}
              inputProps={{ inputMode: "decimal" }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">P</InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4} sx={{ minWidth: 0 }}>
            <TextField
              fullWidth
              label="APY"
              value={form.apy}
              onChange={handleChange("apy")}
              error={Boolean(fieldErrors.apy)}
              helperText={fieldErrors.apy || "Nominal annual rate (%)"}
              inputProps={{ inputMode: "decimal" }}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4} sx={{ minWidth: 0 }}>
            <TextField
              fullWidth
              label="Duration"
              value={form.duration}
              onChange={handleChange("duration")}
              error={Boolean(fieldErrors.duration)}
              helperText={fieldErrors.duration || "Supports fractions (e.g. 1.5)"}
              inputProps={{ inputMode: "decimal" }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4} sx={{ minWidth: 0 }}>
            <FormControl fullWidth>
              <InputLabel id="duration-unit-label">Duration unit</InputLabel>
              <Select
                labelId="duration-unit-label"
                label="Duration unit"
                value={form.durationUnit}
                onChange={handleChange("durationUnit") as any}
              >
                <MenuItem value="days">Days</MenuItem>
                <MenuItem value="years">Years</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4} sx={{ minWidth: 0 }}>
            <FormControl fullWidth>
              <InputLabel id="compounding-label">Compounding</InputLabel>
              <Select
                labelId="compounding-label"
                label="Compounding"
                value={form.compoundingFrequency}
                onChange={handleChange("compoundingFrequency") as any}
              >
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="annually">Annually</MenuItem>
              </Select>
              <FormHelperText>Times interest compounds per year</FormHelperText>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4} sx={{ minWidth: 0 }}>
            <TextField
              fullWidth
              label="Token price (optional)"
              value={form.tokenPrice}
              onChange={handleChange("tokenPrice")}
              error={Boolean(fieldErrors.tokenPrice)}
              helperText={fieldErrors.tokenPrice || "USD per token"}
              inputProps={{ inputMode: "decimal" }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">$</InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>

        <Box
          sx={{
            mt: 3,
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Button
            type="submit"
            variant="contained"
            disabled={status === "loading"}
            fullWidth={isNarrow}
            sx={{
              backgroundColor: accent,
              color: "#fff",
              fontWeight: 700,
              textTransform: "uppercase",
              px: { xs: 2, sm: 4 },
              py: 1.5,
              borderRadius: "6px",
              minWidth: { xs: "100%", sm: 200 },
              "&:hover": { backgroundColor: "#00c4cb" },
            }}
          >
            {status === "loading" ? "Calculating…" : "Calculate rewards"}
          </Button>
          {status === "loading" && (
            <CircularProgress size={28} sx={{ color: accent }} />
          )}
        </Box>
      </Box>

      {status === "idle" && !result && (
        <Alert severity="info" sx={{ mt: 3 }}>
          Enter your staking parameters and calculate to see projected balance,
          rewards, and growth over time.
        </Alert>
      )}

      {status === "error" && errorMessage && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {errorMessage}
        </Alert>
      )}

      {result && (
        <Box sx={{ mt: 4, maxWidth: "100%", overflow: "hidden" }}>
          <Grid container spacing={{ xs: 1.5, sm: 2 }}>
            <Grid item xs={12} sm={6} md={3} sx={{ minWidth: 0 }}>
              <StatCard
                label="Projected balance"
                value={formatNumber(result.projectedBalance)}
                accent={accent}
                navy={navy}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3} sx={{ minWidth: 0 }}>
              <StatCard
                label="Total rewards"
                value={formatNumber(result.totalRewards)}
                accent={accent}
                navy={navy}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3} sx={{ minWidth: 0 }}>
              <StatCard
                label="Duration (years)"
                value={formatNumber(result.durationYears, 6)}
                accent={accent}
                navy={navy}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3} sx={{ minWidth: 0 }}>
              <StatCard
                label="Compounds / year"
                value={String(result.compoundingPeriodsPerYear)}
                accent={accent}
                navy={navy}
              />
            </Grid>
            {result.projectedBalanceUsd != null && (
              <>
                <Grid item xs={12} sm={6} sx={{ minWidth: 0 }}>
                  <StatCard
                    label="Projected balance (USD)"
                    value={`$${formatNumber(result.projectedBalanceUsd, 2)}`}
                    accent={accent}
                    navy={navy}
                  />
                </Grid>
                <Grid item xs={12} sm={6} sx={{ minWidth: 0 }}>
                  <StatCard
                    label="Total rewards (USD)"
                    value={`$${formatNumber(result.totalRewardsUsd || 0, 2)}`}
                    accent={accent}
                    navy={navy}
                  />
                </Grid>
              </>
            )}
          </Grid>

          <Typography
            sx={{
              mt: 4,
              mb: 2,
              fontWeight: 700,
              color: theme.palette.mode === "dark" ? "#fff" : navy,
            }}
          >
            Projected balance growth
          </Typography>
          <Box
            sx={{
              width: "100%",
              maxWidth: "100%",
              height: isNarrow ? 220 : isMobile ? 260 : 340,
              minWidth: 0,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartSeries}
                margin={{
                  top: 8,
                  right: isNarrow ? 8 : 16,
                  left: isNarrow ? 0 : 4,
                  bottom: 8,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#d7eef1" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: isNarrow ? 10 : 12 }}
                  interval="preserveStartEnd"
                  minTickGap={isNarrow ? 24 : 12}
                />
                <YAxis
                  tick={{ fontSize: isNarrow ? 10 : 12 }}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => formatNumber(Number(v), 2)}
                  width={isNarrow ? 52 : 72}
                />
                <Tooltip
                  formatter={(value: number) => [
                    formatNumber(value, 6),
                    "Balance",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke={accent}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  isAnimationActive={!isNarrow}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: "block", wordBreak: "break-word" }}
          >
            Rate model: {result.assumptions.rateModel} —{" "}
            {result.assumptions.formula}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

const StatCard = ({
  label,
  value,
  accent,
  navy,
}: {
  label: string;
  value: string;
  accent: string;
  navy: string;
}) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        border: `1px solid ${accent}`,
        borderRadius: "6px",
        p: { xs: 1.5, sm: 2 },
        height: "100%",
        boxSizing: "border-box",
        maxWidth: "100%",
        overflow: "hidden",
        background:
          theme.palette.mode === "dark"
            ? "rgba(0,219,227,0.08)"
            : "rgba(0,219,227,0.06)",
      }}
    >
      <Typography
        sx={{ fontSize: 13, color: theme.palette.text.secondary, mb: 0.5 }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: 18, md: 24 },
          fontWeight: 700,
          color: theme.palette.mode === "dark" ? "#fff" : navy,
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
};

export default StakingCalculator;
