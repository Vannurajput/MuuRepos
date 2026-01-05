import pptxgen from 'pptxgenjs';
import { QueryResult, ChartConfig, PinnedChart, DashboardLayout } from '../types';

class ExportService {
  
  /**
   * Downloads a QueryResult as a CSV file.
   */
  downloadCSV(result: QueryResult, filename: string = 'export.csv') {
    if (!result || result.rows.length === 0) return;

    const headers = result.columns.join(',');
    const rows = result.rows.map(row => 
      row.map(cell => {
        if (cell === null) return '';
        const str = String(cell);
        // Escape quotes and wrap in quotes if contains comma
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    );

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Generates a PowerPoint presentation from a Dashboard Layout and its Data.
   */
  async exportDashboardToPPT(
    dashboard: DashboardLayout, 
    pinnedCharts: PinnedChart[], 
    resultsMap: Record<string, QueryResult>
  ) {
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_16x9';
    pres.author = 'Muul SQL Studio';
    pres.title = dashboard.title;

    // Title Slide
    let slide = pres.addSlide();
    slide.background = { color: '0f172a' }; // Slate 900
    slide.addText(dashboard.title, { 
      x: 0.5, y: 2.5, w: '90%', fontSize: 44, color: '3b82f6', bold: true, align: 'center' 
    });
    slide.addText(`Generated on ${new Date().toLocaleDateString()}`, { 
      x: 0.5, y: 3.5, w: '90%', fontSize: 18, color: '94a3b8', align: 'center' 
    });

    // Iterate Rows
    for (const row of dashboard.rows) {
      for (const widget of row.widgets) {
        if (widget.type === 'markdown') {
            // Markdown Slide
            const s = pres.addSlide();
            s.background = { color: '0f172a' };
            s.addText(widget.title || 'Text Widget', { x: 0.5, y: 0.5, fontSize: 24, color: 'e2e8f0', bold: true });
            // Strip markdown chars for simple text (rough approximation)
            const plainText = widget.content.replace(/[#*`]/g, ''); 
            s.addText(plainText, { x: 0.5, y: 1.2, w: '90%', h: '80%', fontSize: 14, color: 'cbd5e1', valign: 'top' });
        } else if (widget.type === 'chart') {
            const chartDef = pinnedCharts.find(c => c.id === widget.content);
            const data = resultsMap[widget.content];
            
            if (chartDef && data && data.rows.length > 0) {
                const s = pres.addSlide();
                s.background = { color: '0f172a' };
                s.addText(widget.title || chartDef.title, { x: 0.5, y: 0.5, fontSize: 18, color: 'e2e8f0', bold: true });
                
                // Prepare Data for PPTX
                const labels = data.rows.map(r => String(r[data.columns.indexOf(chartDef.config.xAxisKey)] || ''));
                const series = chartDef.config.dataKeys.map(key => {
                    const idx = data.columns.indexOf(key);
                    return {
                        name: key,
                        values: data.rows.map(r => Number(r[idx]) || 0)
                    };
                });

                // Map Chart Types
                let pptChartType = pres.ChartType.bar;
                if (chartDef.config.type === 'line') pptChartType = pres.ChartType.line;
                else if (chartDef.config.type === 'area') pptChartType = pres.ChartType.area;
                else if (chartDef.config.type === 'pie') pptChartType = pres.ChartType.pie;
                else if (chartDef.config.type === 'scatter') pptChartType = pres.ChartType.scatter;
                else if (chartDef.config.type === 'radar') pptChartType = pres.ChartType.radar;

                // Add Chart
                s.addChart(pptChartType, series, {
                    x: 0.5, y: 1.0, w: '90%', h: '80%',
                    showLegend: true,
                    legendPos: 'b',
                    showTitle: false,
                    catAxisLabels: labels,
                    // Styling to match Dark Mode roughly
                    chartColors: ['3b82f6', '10b981', 'f59e0b', 'ef4444', '8b5cf6', 'ec4899'],
                    chartArea: { fill: { color: '0f172a' } },
                    plotArea: { fill: { color: '0f172a' } },
                    valGridLine: { color: '334155' },
                    catGridLine: { color: '334155' },
                    valAxisLabelColor: '94a3b8',
                    catAxisLabelColor: '94a3b8',
                    legendColor: 'e2e8f0'
                });
            }
        }
      }
    }

    pres.writeFile({ fileName: `${dashboard.title.replace(/\s+/g, '_')}.pptx` });
  }
}

export const exportService = new ExportService();