"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PortfolioTrendPoint } from "@/lib/types/bfi";

type SectorItem = {
  sector: string;
  attributedCo2e: number;
  loanCount: number;
};

type TaxonomyItem = {
  name: string;
  value: number;
  color: string;
};

const SECTOR_COLORS = [
  "#fca5a5", // red (cement, brick — top emitters)
  "#fdba74", // orange (steel)
  "#fcd34d", // amber (manufacturing)
  "#c4b5fd", // purple (textiles)
  "#fbcfe8", // pink
  "#7dd3fc", // accent blue (hydropower)
  "#86efac", // green
];

export const TAXONOMY_FILL = {
  green: "#86efac",
  amber: "#fcd34d",
  red: "#fca5a5",
  unclassified: "#64748b",
} as const;

const TOOLTIP_STYLE = {
  backgroundColor: "#0f172a",
  border: "1px solid #243244",
  borderRadius: 12,
  fontSize: 12,
};

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value}`;
}

export function SectorEmissionsChart({ data }: { data: SectorItem[] }) {
  const chartData = data.slice(0, 8).map((d) => ({
    ...d,
    shortSector:
      d.sector.length > 25 ? d.sector.slice(0, 22) + "..." : d.sector,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 16 }}>
          <CartesianGrid stroke="#243244" strokeDasharray="3 3" />
          <XAxis
            type="number"
            stroke="#93a4b8"
            tickFormatter={(v) => compact(v)}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            dataKey="shortSector"
            type="category"
            width={180}
            stroke="#93a4b8"
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number) =>
              `${new Intl.NumberFormat("en-US").format(value)} tCO2e`
            }
            labelFormatter={(label) => {
              const item = chartData.find((d) => d.shortSector === label);
              return item ? item.sector : label;
            }}
          />
          <Bar dataKey="attributedCo2e" radius={[0, 8, 8, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TaxonomyPieChart({
  data,
  mode = "count",
}: {
  data: { green: number; amber: number; red: number; unclassified: number };
  mode?: "count" | "value";
}) {
  const items: TaxonomyItem[] = [
    { name: "Green", value: data.green, color: TAXONOMY_FILL.green },
    { name: "Amber", value: data.amber, color: TAXONOMY_FILL.amber },
    { name: "Red", value: data.red, color: TAXONOMY_FILL.red },
    {
      name: "Unclassified",
      value: data.unclassified,
      color: TAXONOMY_FILL.unclassified,
    },
  ].filter((d) => d.value > 0);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={items}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) =>
              `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`
            }
            labelLine={false}
          >
            {items.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number) =>
              mode === "value"
                ? `NPR ${new Intl.NumberFormat("en-US").format(value)}`
                : `${value.toLocaleString()} loans`
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EmissionsTrendChart({
  data,
}: {
  data: PortfolioTrendPoint[];
}) {
  const rows = data.map((p) => ({
    year: p.year,
    red: p.byTaxonomy.red,
    amber: p.byTaxonomy.amber,
    green: p.byTaxonomy.green,
    unclassified: p.byTaxonomy.unclassified,
    total: p.totalAttributedCo2eTonnes,
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={rows} margin={{ top: 8, left: 10, right: 16, bottom: 0 }}>
          <CartesianGrid stroke="#243244" strokeDasharray="3 3" />
          <XAxis dataKey="year" stroke="#93a4b8" tick={{ fontSize: 11 }} />
          <YAxis
            stroke="#93a4b8"
            tickFormatter={(v) => compact(v)}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name: string) =>
              [
                `${new Intl.NumberFormat("en-US").format(value)} tCO2e`,
                name,
              ]
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="red"
            stackId="1"
            stroke={TAXONOMY_FILL.red}
            fill={TAXONOMY_FILL.red}
            fillOpacity={0.5}
            name="Red"
          />
          <Area
            type="monotone"
            dataKey="amber"
            stackId="1"
            stroke={TAXONOMY_FILL.amber}
            fill={TAXONOMY_FILL.amber}
            fillOpacity={0.5}
            name="Amber"
          />
          <Area
            type="monotone"
            dataKey="green"
            stackId="1"
            stroke={TAXONOMY_FILL.green}
            fill={TAXONOMY_FILL.green}
            fillOpacity={0.5}
            name="Green"
          />
          <Area
            type="monotone"
            dataKey="unclassified"
            stackId="1"
            stroke={TAXONOMY_FILL.unclassified}
            fill={TAXONOMY_FILL.unclassified}
            fillOpacity={0.5}
            name="Unclassified"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DataQualityBars({
  distribution,
}: {
  distribution: Array<{
    score: 1 | 2 | 3 | 4 | 5;
    loanCount: number;
    outstandingUsd: number;
    attributedCo2eTonnes: number;
  }>;
}) {
  const rows = distribution.map((d) => ({
    score: `Score ${d.score}`,
    outstandingUsd: d.outstandingUsd,
    loanCount: d.loanCount,
    attributedCo2eTonnes: d.attributedCo2eTonnes,
    fill:
      d.score <= 2
        ? "#86efac"
        : d.score === 3
          ? "#7dd3fc"
          : d.score === 4
            ? "#fcd34d"
            : "#fca5a5",
  }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, left: 10, right: 16 }}>
          <CartesianGrid stroke="#243244" strokeDasharray="3 3" />
          <XAxis dataKey="score" stroke="#93a4b8" tick={{ fontSize: 11 }} />
          <YAxis
            stroke="#93a4b8"
            tickFormatter={(v) => `$${compact(v)}`}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(_: number, _name, item) => {
              const row = item as unknown as { payload: (typeof rows)[number] };
              return [
                `$${new Intl.NumberFormat("en-US").format(row.payload.outstandingUsd)} outstanding`,
                `${row.payload.loanCount.toLocaleString()} loans · ${new Intl.NumberFormat("en-US").format(row.payload.attributedCo2eTonnes)} tCO2e`,
              ];
            }}
          />
          <Bar dataKey="outstandingUsd" radius={[8, 8, 0, 0]}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
