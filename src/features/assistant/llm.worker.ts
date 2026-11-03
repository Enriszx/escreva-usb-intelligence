/// <reference lib="webworker" />
// A IA roda neste worker para a tela não travar enquanto ela pensa.
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => handler.onmessage(msg);
