import { TimeSeries, SeriesConfiguration, ColorSchema, Layout, FrameInfo, PlotSeries, PlotPoint } from '../util/Types';
import AnimationFrameInfoGenerator from './AnimationFrameInfoGenerator';
import SvgWriter from './CanvasWriter';
import DataFrameFilter from './DataFrameFilter';
import Log10PlotPointsGenerator from './Log10PlotPointsGenerator';
import ScaledPointsGenerator from './ScaledPointsGenerator';
import CanvasPointsGenerator from './CanvasPointsGenerator';
import { DateTime } from 'luxon';

const X_LABEL = 'total confirmed cases (log)';
const Y_LABEL = 'new confirmed cases (log, last week)';

export default class ImageGenerator
{
	// Fields

	private canvasGenerator: CanvasPointsGenerator;
	private color: ColorSchema;
	private filter: DataFrameFilter;
	private layout: Layout;
	private scaledGenerator: ScaledPointsGenerator;
	private series: PlotSeries[];


	// Constructor

	public constructor (series: TimeSeries[], configuration: SeriesConfiguration[],
		color: ColorSchema, layout: Layout)
	{
		this.color = color;
		this.layout = layout;
		this.series = this.createPlotSeries(series, configuration);
		this.filter = new DataFrameFilter(this.series);
		this.scaledGenerator = new ScaledPointsGenerator({
			horizontal: { min: 1, max: 6 }, // log10
			vertical: { min: 1, max: 6 } // log10
		});
		this.canvasGenerator = new CanvasPointsGenerator(layout.plotArea);
	}


	// Public methods

	public async generate(outputDirectory: string,
		frames: number, extraFrames: number, days: number)
	{
		// Setup bounderies
		const writer = new SvgWriter(outputDirectory, this.layout.canvasSize, this.color.background);
		const frameInfoGenerator = new AnimationFrameInfoGenerator(this.series, frames, extraFrames, days);

		for (const frameInfo of frameInfoGenerator.generate())
			await this.drawFrame(frameInfo, writer);
	}


	// Private methods

	private createPlotSeries(series: TimeSeries[], configuration: SeriesConfiguration[]): PlotSeries[]
	{
		return configuration.map(seriesConf =>
		{
			const found = series.find(s => s.name === seriesConf.name);
			if (!found)
				throw new Error(`Time series not found: ${seriesConf.name}`);
			return {
				code: seriesConf.code,
				color: seriesConf.color,
				points: Log10PlotPointsGenerator.generate(found.data)
			};
		});
	}

	private async drawFrame(frameInfo: FrameInfo, writer: SvgWriter)
	{
		writer.clean();

		const filteredData = this.filter.apply(frameInfo);
		for (const series of filteredData)
		{
			// Draw series
			const points = series.points
				.map(point => this.scaledGenerator.generate(point))
				.map(point => this.canvasGenerator.generate(point));
			this.drawSeriesLines(points, series.color, writer);
			this.drawSeriesCircle(points, series.color, writer);
			this.drawSeriesLabel(points, series.code, writer);

			// Draw other items
			this.drawScale(writer);
			this.drawDate(writer, frameInfo.date);
			this.drawSignature(writer);
		}

		await writer.save();
	}

	private drawSeriesLines(points: PlotPoint[], color: string, writer: SvgWriter)
	{
		if (points.length < 2)
			return;

		writer.drawPolyline(color, 3, points, this.layout.plotArea);
	}

	private drawSeriesCircle(points: PlotPoint[], color: string, writer: SvgWriter)
	{
		if (!points.length)
			return;

		const point = points[points.length - 1];
		writer.drawCircle(this.layout.circleSize, color, point, this.layout.plotArea);
	}

	private drawSeriesLabel(points: PlotPoint[], label: string, writer: SvgWriter)
	{
		if (!points.length)
			return;

		const point = points[points.length - 1];
		const x = point.x + this.color.series.offset.x;
		const y = point.y + this.color.series.offset.y;
		writer.drawText(
			label, this.color.series.font, this.color.series.color,
			{ x, y }, this.layout.plotArea);
	}

	private drawScale(writer: SvgWriter)
	{
		// Lines
		const area = this.layout.plotArea;
		const points = [
			{ x: area.left, y: area.top },
			{ x: area.left, y: area.bottom },
			{ x: area.right, y: area.bottom }
		];
		writer.drawPolyline(this.color.scale.color, 2, points);

		// Label X
		const boxX = {
			left: area.left,
			right: area.right,
			top: area.bottom,
			bottom: area.bottom + this.color.axis.offset
		};
		writer.drawBoxedText(X_LABEL, this.color.axis.font, this.color.axis.color, boxX);

		// Label Y
		const boxY = {
			left: area.left - this.color.axis.offset,
			right: area.left,
			top: area.top,
			bottom: area.bottom
		};
		writer.drawBoxedText(Y_LABEL, this.color.axis.font, this.color.axis.color, boxY, -90);
	}

	private drawDate(writer: SvgWriter, date: DateTime)
	{
		writer.drawText(
			date.toISODate(),
			this.color.date.font,
			this.color.date.color,
			this.layout.datePosition);
	}

	private drawSignature(writer: SvgWriter)
	{
		// writer.drawText(
		// 	SIGNATURE,
		// 	this.layout.signature.font,
		// 	this.layout.signature.position);
	}
}
