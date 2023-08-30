import ErrorStackParser from "error-stack-parser";
import { type RawSourceMap, SourceMapConsumer } from "source-map-js";

export interface Env {
	SCM_BUCKET: R2Bucket;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			if (request.url.endsWith('/error')) {
				throw new Error('manual-error');
			}
			if (request.url.endsWith('/direct-error')) {
				throw new Error('direct-error');
			}
			return new Response('Hello World!');
		} catch (err) {
			if (err instanceof Error && err.message === 'manual-error') {
				const mapFileBody = await env.SCM_BUCKET.get('worker.js.map');
				const map = await mapFileBody?.json();
				const consumer = new SourceMapConsumer(map as RawSourceMap);
				const frames = ErrorStackParser.parse(err);
				const originalFrames = frames.map(frame => {
					return consumer.originalPositionFor({
						line: frame.lineNumber!,
						column: frame.columnNumber!,
					});
				});
				let out = "Error: " + err.message + '\n';
				for (const f of originalFrames) {
					out += `  at ${f.source}:${f.line}:${f.column}\n`;
				}

				return new Response(out, { status: 500 });
			}
			throw err;
		}
	},
};
