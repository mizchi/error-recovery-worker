import ErrorStackParser from "error-stack-parser";
import { type RawSourceMap, SourceMapConsumer } from "source-map-js";
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import { DB } from "./db/types";

type SerializedError = {
	id: string;
	name: string;
	message: string;
	stack: string;
	url: string;
	at: number;
	ua?: string | null;
};

export interface Env {
	SCM_BUCKET: R2Bucket;
	DB: D1Database;
	ERROR_QUEUES?: Queue<SerializedError>;
}

// TODO: notify change
let _smc: SourceMapConsumer = null as any;
async function loadSMC(bucket: R2Bucket) {
	if (_smc) return _smc;
	// build source map consumer
	const map = await bucket.get("worker.js.map").then((res) => res?.json());
	if (map) {
		return _smc = new SourceMapConsumer(map as RawSourceMap);
	}
	throw new Error("no source map");
}

class ExceededError extends Error {}

function buildOriginalStack(serr: SerializedError, originalPositionFor: SourceMapConsumer['originalPositionFor']) {
	const frames = ErrorStackParser.parse(serr as Error);
	const originalFrames = frames.map((frame) => {
		return originalPositionFor({
			line: frame.lineNumber!,
			column: frame.columnNumber!,
		});
	});
	const hasNullMap = originalFrames.some((f) => f.source === null);
	if (hasNullMap) _smc = null as any;
	// build error format
	return JSON.stringify(originalFrames.map((f) => {
		return {
			source: f.source,
			line: f.line,
			column: f.column,
		};
	}));
}

export default {
	async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
		console.log("[queue]", batch.messages.length);
		const db = new Kysely<DB>({ dialect: new D1Dialect({ database: env.DB }) });

		if (!batch.messages) return;
		const smc = await loadSMC(env.SCM_BUCKET);
		for (const mes of batch.messages) {
			const serr = mes.body as SerializedError;
			const newStack = buildOriginalStack(mes.body as SerializedError, smc.originalPositionFor.bind(smc));
			await db.insertInto("ErrorRecord").values({
				id: serr.id,
				name: serr.name,
				message: serr.message,
				stack: serr.stack,
				originalStack: newStack,
				url: serr.url,
				ua: serr.ua,
				at: serr.at,
			}).execute();
		}
	},
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		try {
			if (request.url.endsWith("/error")) {
				throw new Error("manual-error");
			}
			if (request.url.endsWith("/random")) {
				const v = Math.random();
				if (v > 0.5) {
					throw new ExceededError("exceeded:" + v);
				}
				return new Response("pass");
			}
			const db = new Kysely<DB>({ dialect: new D1Dialect({ database: env.DB }) });
			const records = await db.selectFrom("ErrorRecord").selectAll().execute();

			const newRecords = records.map((r) => {
				return {
					...r,
					originalStack: JSON.parse(r.originalStack),
				}
			});

			return new Response(JSON.stringify(newRecords, null, 2), {
				headers: {
					"content-type": "application/json",
				},
			});
		} catch (err) {
			if (err instanceof Error) {
				const id = Math.random().toString(36).slice(2);
				const serr = {
					id,
					name: err.name,
					message: err.message,
					stack: err.stack!,
					url: request.url,
					ua: request.headers.get("user-agent"),
					at: Date.now(),
				} satisfies SerializedError;

				if (env.ERROR_QUEUES) {
					await env.ERROR_QUEUES.send(serr);
				}
				return Response.json({
					message: err.message,
					id,
				}, { status: 500 });
			}
			throw err;
		}
	},
};
