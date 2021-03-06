
import * as Enumerable from 'linq';
import { Scale, PlotSeries } from '../util/Types';

const MARGIN = 0.2;

export default class DynamicScaleGenerator
{
	public static generate(series: PlotSeries[]): Scale {
		const lastPoints = Enumerable.from(
			Enumerable
				.from(series)
				.select(serie => serie.points)
				.where(points => points && points.length > 0)
				.select(points => points[points.length - 1])
				.selectMany(point => [point.x, point.y])
				.where(x => !!x)
				.toArray());

		const min = Math.max(lastPoints.min(), 1);
		const max = Math.max(lastPoints.max(), 1);
		return {
			horizontal: {
				min: min - MARGIN,
				max: max + MARGIN
			},
			vertical: {
				min: min - MARGIN,
				max: max + MARGIN
			}
		};
	}
}
