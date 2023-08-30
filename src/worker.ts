import ErrorStackParser from "error-stack-parser";
import { type RawSourceMap, SourceMapConsumer } from "source-map-js";

export interface Env {
	SCM_BUCKET: R2Bucket;
}

// TODO: notify change
let _smc: SourceMapConsumer = null as any;
async function loadSMC(bucket: R2Bucket) {
	if (_smc) return _smc;
	const mapFileBody = await bucket.get('worker.js.map');
	const map = await mapFileBody?.json();
	const consumer = new SourceMapConsumer(map as RawSourceMap);
	_smc = consumer;
	return consumer
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
				const smc = await loadSMC(env.SCM_BUCKET);
				const frames = ErrorStackParser.parse(err);
				const originalFrames = frames.map(frame => {
					return smc.originalPositionFor({
						line: frame.lineNumber!,
						column: frame.columnNumber!,
					});
				});
				// build error format
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
