import React from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis
} from 'recharts';
import { 
  BarChart3, LineChart as LineChartIcon, Activity, PieChart as PieChartIcon, 
  ScatterChart as ScatterIcon, Hexagon 
} from 'lucide-react';

// --- Individual Chart Components ---

// Fix: Rewrote components using React.createElement to avoid JSX parsing issues in a .ts file.
const BarChartViz = ({ data, config, commonProps }) => {
  return React.createElement(
    BarChart,
    { data: data },
    commonProps.grid,
    commonProps.xAxis,
    commonProps.yAxis,
    commonProps.tooltip,
    commonProps.legend,
    ...config.dataKeys.map((key, index) =>
      React.createElement(Bar, {
        key: key,
        dataKey: key,
        stackId: config.stackId,
        fill: commonProps.colors[index % commonProps.colors.length],
        radius: config.stackId ? [0, 0, 0, 0] : [4, 4, 0, 0],
      })
    )
  );
};

const LineChartViz = ({ data, config, commonProps }) => {
  return React.createElement(
    LineChart,
    { data: data },
    commonProps.grid,
    commonProps.xAxis,
    commonProps.yAxis,
    commonProps.tooltip,
    commonProps.legend,
    ...config.dataKeys.map((key, index) =>
      React.createElement(Line, {
        key: key,
        type: "monotone",
        dataKey: key,
        stroke: commonProps.colors[index % commonProps.colors.length],
        strokeWidth: 2,
        dot: { r: 3 },
        activeDot: { r: 5 },
      })
    )
  );
};

const AreaChartViz = ({ data, config, commonProps }) => {
  return React.createElement(
    AreaChart,
    { data: data },
    commonProps.grid,
    commonProps.xAxis,
    commonProps.yAxis,
    commonProps.tooltip,
    commonProps.legend,
    ...config.dataKeys.map((key, index) =>
      React.createElement(Area, {
        key: key,
        type: "monotone",
        dataKey: key,
        stackId: config.stackId,
        stroke: commonProps.colors[index % commonProps.colors.length],
        fill: commonProps.colors[index % commonProps.colors.length],
        fillOpacity: config.stackId ? 0.6 : 0.3,
      })
    )
  );
};

const PieChartViz = ({ data, config, commonProps, isReadOnly }) => {
  return React.createElement(
    PieChart,
    null,
    React.createElement(
      Pie,
      {
        data: data,
        dataKey: config.dataKeys[0],
        nameKey: config.xAxisKey,
        cx: "50%",
        cy: "50%",
        outerRadius: isReadOnly ? 80 : 100,
        fill: "#8884d8",
        label: !isReadOnly,
      },
      ...data.map((_entry, index) =>
        React.createElement(Cell, {
          key: `cell-${index}`,
          fill: commonProps.colors[index % commonProps.colors.length],
        })
      )
    ),
    commonProps.tooltip,
    !isReadOnly ? commonProps.legend : null
  );
};

const ScatterChartViz = ({ data, config, commonProps }) => {
  return React.createElement(
    ScatterChart,
    null,
    commonProps.grid,
    React.createElement(XAxis, {
      type: "category",
      dataKey: config.xAxisKey,
      name: config.xAxisKey,
      ...commonProps.xAxis.props,
    }),
    React.createElement(YAxis, {
      type: "number",
      dataKey: config.dataKeys[0],
      name: config.dataKeys[0],
      ...commonProps.yAxis.props,
    }),
    commonProps.tooltip,
    commonProps.legend,
    ...config.dataKeys.map((key, index) =>
      React.createElement(Scatter, {
        key: key,
        name: key,
        data: data,
        fill: commonProps.colors[index % commonProps.colors.length],
      })
    )
  );
};

const RadarChartViz = ({ data, config, commonProps }) => {
  return React.createElement(
    RadarChart,
    { cx: "50%", cy: "50%", outerRadius: "80%", data: data },
    React.createElement(PolarGrid, { stroke: "#334155" }),
    React.createElement(PolarAngleAxis, {
      dataKey: config.xAxisKey,
      tick: { fill: "#94a3b8", fontSize: 10 },
    }),
    React.createElement(PolarRadiusAxis, {
      angle: 30,
      domain: [0, "auto"],
      tick: { fill: "#94a3b8", fontSize: 10 },
    }),
    ...config.dataKeys.map((key, index) =>
      React.createElement(Radar, {
        key: key,
        name: key,
        dataKey: key,
        stroke: commonProps.colors[index % commonProps.colors.length],
        fill: commonProps.colors[index % commonProps.colors.length],
        fillOpacity: 0.4,
      })
    ),
    commonProps.legend,
    commonProps.tooltip
  );
};


// --- The Registry ---
export const VisualizationRegistry = {
  bar: {
    name: 'Bar Chart',
    icon: BarChart3,
    render: BarChartViz,
  },
  line: {
    name: 'Line Chart',
    icon: LineChartIcon,
    render: LineChartViz,
  },
  area: {
    name: 'Area Chart',
    icon: Activity,
    render: AreaChartViz,
  },
  pie: {
    name: 'Pie Chart',
    icon: PieChartIcon,
    render: PieChartViz,
  },
  scatter: {
    name: 'Scatter Plot',
    icon: ScatterIcon,
    render: ScatterChartViz,
  },
  radar: {
    name: 'Radar Chart',
    icon: Hexagon,
    render: RadarChartViz,
  },
};
