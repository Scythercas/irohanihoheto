/**
 * シナリオYAML → Scene への変換と検証（純粋関数）。
 *
 * ブラウザ用の読み込み（loader.ts）とCLI検証（scripts/check-scenario.ts）の
 * 両方から使うため、Vite固有のAPIをここに持ち込まないこと。
 *
 * 書き手が `kind:` を毎行書かなくて済むよう、「どのキーを持つか」から
 * ノード種別を推論する。壊れたYAMLは即座に例外にする。実行中に静かに
 * 無視するより、シーンIDと位置を添えて落ちるほうが執筆効率が高い。
 */

import yaml from 'js-yaml';
import { CHARACTERS } from '../constants';
import { ENDING_ROUTES } from '../types';
import type {
  BranchCase,
  CharacterId,
  ChoiceOption,
  EndingRoute,
  HeroineId,
  ParamDelta,
  Scene,
  ScenarioNode,
} from '../types';
import { MASHIRO_SCENES, DATE_SCENES, EXTRA_DATE_SCENES, FILLER_SCENE, FINALE_SCENE } from '../schedule';

class ScenarioError extends Error {
  constructor(file: string, sceneId: string, index: number | null, message: string) {
    const where =
      index === null ? `${file} / scene "${sceneId}"` : `${file} / scene "${sceneId}" / body[${index}]`;
    super(`[シナリオ定義エラー] ${where}: ${message}`);
    this.name = 'ScenarioError';
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const VALID_CHARACTER_IDS = new Set(Object.keys(CHARACTERS));
const VALID_PARAM_KEYS = new Set<string>(['sincerity', 'tolerance', 'humor', 'sensibility', 'confidence']);
const VALID_HEROINE_IDS = new Set<string>(['aoi', 'sui', 'touka', 'shion', 'momoka']);
const VALID_ENDING_ROUTES = new Set<string>(ENDING_ROUTES);

function parseParamDelta(raw: unknown, file: string, sceneId: string, index: number): ParamDelta {
  if (!isRecord(raw)) {
    throw new ScenarioError(file, sceneId, index, 'params は「パラメータ名: 数値」の形式で書いてください');
  }
  const out: ParamDelta = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!VALID_PARAM_KEYS.has(key)) {
      throw new ScenarioError(
        file,
        sceneId,
        index,
        `params のキー "${key}" は未定義です（有効: ${[...VALID_PARAM_KEYS].join(', ')}）`,
      );
    }
    if (typeof value !== 'number') {
      throw new ScenarioError(file, sceneId, index, `params.${key} は数値で書いてください`);
    }
    out[key as keyof ParamDelta] = value;
  }
  return out;
}

function parseChoiceOption(raw: unknown, file: string, sceneId: string, index: number): ChoiceOption {
  if (!isRecord(raw) || typeof raw.text !== 'string') {
    throw new ScenarioError(file, sceneId, index, 'choice の各項目には text（文字列）が必要です');
  }
  const option: ChoiceOption = { text: raw.text };

  if (raw.who !== undefined) {
    if (typeof raw.who !== 'string' || !VALID_CHARACTER_IDS.has(raw.who)) {
      throw new ScenarioError(
        file,
        sceneId,
        index,
        `選択肢の who "${String(raw.who)}" は未定義のキャラクターです（この選択肢が誰についてのものかを示す）`,
      );
    }
    option.who = raw.who as CharacterId;
  }
  if (raw.params !== undefined) {
    option.params = parseParamDelta(raw.params, file, sceneId, index);
  }
  if (raw.affection !== undefined) {
    if (!isRecord(raw.affection)) {
      throw new ScenarioError(file, sceneId, index, 'affection は「ヒロインID: 数値」の形式で書いてください');
    }
    for (const [key, value] of Object.entries(raw.affection)) {
      if (!VALID_HEROINE_IDS.has(key)) {
        throw new ScenarioError(file, sceneId, index, `affection のキー "${key}" は未定義のヒロインです`);
      }
      if (typeof value !== 'number') {
        throw new ScenarioError(file, sceneId, index, `affection.${key} は数値で書いてください`);
      }
    }
    option.affection = raw.affection as ChoiceOption['affection'];
  }
  if (raw.goto !== undefined) {
    if (typeof raw.goto !== 'string') throw new ScenarioError(file, sceneId, index, 'goto は文字列で書いてください');
    option.goto = raw.goto;
  }
  if (raw.requireFlag !== undefined) {
    if (typeof raw.requireFlag !== 'string') {
      throw new ScenarioError(file, sceneId, index, 'requireFlag は文字列で書いてください');
    }
    option.requireFlag = raw.requireFlag;
  }
  return option;
}

function parseNode(raw: unknown, file: string, sceneId: string, index: number): ScenarioNode {
  if (!isRecord(raw)) {
    throw new ScenarioError(file, sceneId, index, 'body の各項目はマッピング（key: value）で書いてください');
  }

  // --- セリフ・地の文 -------------------------------------------------------
  if (raw.text !== undefined) {
    if (typeof raw.text !== 'string') {
      throw new ScenarioError(file, sceneId, index, 'text は文字列で書いてください');
    }
    let who: CharacterId | null = null;
    if (raw.who !== undefined && raw.who !== null) {
      if (typeof raw.who !== 'string' || !VALID_CHARACTER_IDS.has(raw.who)) {
        throw new ScenarioError(
          file,
          sceneId,
          index,
          `who "${String(raw.who)}" は未定義のキャラクターです（有効: ${[...VALID_CHARACTER_IDS].join(', ')}）`,
        );
      }
      who = raw.who as CharacterId;
    }
    const node: ScenarioNode = { kind: 'say', who, text: raw.text };
    if (typeof raw.face === 'string') node.face = raw.face;
    if (typeof raw.voice === 'string') node.voice = raw.voice;
    return node;
  }

  // --- 選択肢 ---------------------------------------------------------------
  if (raw.choice !== undefined) {
    if (!Array.isArray(raw.choice) || raw.choice.length === 0) {
      throw new ScenarioError(file, sceneId, index, 'choice は1つ以上の項目を持つ配列で書いてください');
    }
    return { kind: 'choice', options: raw.choice.map((o) => parseChoiceOption(o, file, sceneId, index)) };
  }

  // --- チャット -------------------------------------------------------------
  if (raw.from !== undefined) {
    if (typeof raw.from !== 'string' || !VALID_CHARACTER_IDS.has(raw.from)) {
      throw new ScenarioError(file, sceneId, index, `from "${String(raw.from)}" は未定義のキャラクターです`);
    }
    if (typeof raw.msg !== 'string') {
      throw new ScenarioError(file, sceneId, index, 'チャットの本文は msg に文字列で書いてください');
    }
    const node: ScenarioNode = { kind: 'chat', from: raw.from as CharacterId, text: raw.msg };
    if (typeof raw.at === 'string') node.at = raw.at;
    return node;
  }

  if (raw.reply !== undefined) {
    if (!Array.isArray(raw.reply) || raw.reply.length === 0) {
      throw new ScenarioError(file, sceneId, index, 'reply は1つ以上の項目を持つ配列で書いてください');
    }
    return { kind: 'reply', options: raw.reply.map((o) => parseChoiceOption(o, file, sceneId, index)) };
  }

  // --- カラット -------------------------------------------------------------
  if (raw.carat !== undefined) {
    if (raw.carat !== 'match' && raw.carat !== 'profile') {
      throw new ScenarioError(file, sceneId, index, 'carat は match か profile で書いてください');
    }
    if (typeof raw.target !== 'string' || !VALID_HEROINE_IDS.has(raw.target)) {
      throw new ScenarioError(file, sceneId, index, `carat の target "${String(raw.target)}" は未定義のヒロインです`);
    }
    return { kind: 'carat', view: raw.carat, target: raw.target as HeroineId };
  }

  // --- 週スケジュール -------------------------------------------------------
  if (raw.schedule !== undefined) {
    return { kind: 'schedule' };
  }

  // --- 立ち絵の明示指定 -----------------------------------------------------
  if (raw.stage !== undefined) {
    if (raw.stage === null || raw.stage === 'none') return { kind: 'stage', partner: null };
    if (typeof raw.stage !== 'string' || !VALID_CHARACTER_IDS.has(raw.stage)) {
      throw new ScenarioError(
        file,
        sceneId,
        index,
        `stage は none（退場）かキャラクターIDで書いてください（指定: ${String(raw.stage)}）`,
      );
    }
    return { kind: 'stage', partner: raw.stage as CharacterId };
  }

  // --- 演出 -----------------------------------------------------------------
  if (raw.bg !== undefined) {
    if (typeof raw.bg !== 'string') throw new ScenarioError(file, sceneId, index, 'bg は文字列で書いてください');
    return { kind: 'bg', bg: raw.bg };
  }
  if (raw.bgm !== undefined) {
    if (raw.bgm !== null && typeof raw.bgm !== 'string') {
      throw new ScenarioError(file, sceneId, index, 'bgm は文字列、または停止を表す null で書いてください');
    }
    return { kind: 'bgm', bgm: raw.bgm as string | null };
  }
  if (raw.se !== undefined) {
    if (typeof raw.se !== 'string') throw new ScenarioError(file, sceneId, index, 'se は文字列で書いてください');
    return { kind: 'se', se: raw.se };
  }

  // --- 状態操作 -------------------------------------------------------------
  if (raw.params !== undefined) {
    return { kind: 'param', params: parseParamDelta(raw.params, file, sceneId, index) };
  }
  if (raw.flag !== undefined) {
    if (typeof raw.flag !== 'string') throw new ScenarioError(file, sceneId, index, 'flag は文字列で書いてください');
    return { kind: 'flag', flag: raw.flag, value: raw.value !== false };
  }
  if (raw.goto !== undefined) {
    if (typeof raw.goto !== 'string') throw new ScenarioError(file, sceneId, index, 'goto は文字列で書いてください');
    return { kind: 'goto', goto: raw.goto };
  }

  // --- 条件分岐 -------------------------------------------------------------
  if (raw.branch !== undefined) {
    if (!Array.isArray(raw.branch) || raw.branch.length === 0) {
      throw new ScenarioError(file, sceneId, index, 'branch は1つ以上の項目を持つ配列で書いてください');
    }
    const cases: BranchCase[] = raw.branch.map((rawCase) => {
      if (!isRecord(rawCase) || typeof rawCase.goto !== 'string') {
        throw new ScenarioError(file, sceneId, index, 'branch の各項目には goto（文字列）が必要です');
      }
      const c: BranchCase = { goto: rawCase.goto };
      if (rawCase.ifFlag !== undefined) {
        if (typeof rawCase.ifFlag !== 'string') {
          throw new ScenarioError(file, sceneId, index, 'ifFlag は文字列で書いてください');
        }
        c.ifFlag = rawCase.ifFlag;
      }
      if (rawCase.ifMetCount !== undefined) {
        if (typeof rawCase.ifMetCount !== 'number') {
          throw new ScenarioError(file, sceneId, index, 'ifMetCount は数値で書いてください');
        }
        c.ifMetCount = rawCase.ifMetCount;
      }
      if (rawCase.ifTotalParam !== undefined) {
        if (typeof rawCase.ifTotalParam !== 'number') {
          throw new ScenarioError(file, sceneId, index, 'ifTotalParam は数値で書いてください');
        }
        c.ifTotalParam = rawCase.ifTotalParam;
      }
      if (rawCase.ifParam !== undefined) {
        c.ifParam = parseParamDelta(rawCase.ifParam, file, sceneId, index);
      }
      if (rawCase.ifEnding !== undefined) {
        if (typeof rawCase.ifEnding !== 'string' || !VALID_ENDING_ROUTES.has(rawCase.ifEnding)) {
          throw new ScenarioError(
            file,
            sceneId,
            index,
            `ifEnding "${String(rawCase.ifEnding)}" は未定義です（有効: ${ENDING_ROUTES.join(', ')}）`,
          );
        }
        c.ifEnding = rawCase.ifEnding as EndingRoute;
      }
      return c;
    });

    const last = cases[cases.length - 1];
    if (
      last &&
      (last.ifFlag ||
        last.ifMetCount !== undefined ||
        last.ifTotalParam !== undefined ||
        last.ifParam ||
        last.ifEnding !== undefined)
    ) {
      throw new ScenarioError(
        file,
        sceneId,
        index,
        'branch の最後の項目は「条件なし（それ以外）」にしてください。どの条件も満たさないと走査が止まります',
      );
    }
    return { kind: 'branch', cases };
  }

  throw new ScenarioError(
    file,
    sceneId,
    index,
    `ノードの種別を判別できません（キー: ${Object.keys(raw).join(', ') || 'なし'}）`,
  );
}

function parseScene(raw: unknown, file: string): Scene {
  if (!isRecord(raw) || typeof raw.id !== 'string') {
    throw new ScenarioError(file, '(unknown)', null, 'シーンには id（文字列）が必要です');
  }
  if (!Array.isArray(raw.body)) {
    throw new ScenarioError(file, raw.id, null, 'シーンには body（配列）が必要です');
  }

  const scene: Scene = {
    id: raw.id,
    body: raw.body.map((node, i) => parseNode(node, file, raw.id as string, i)),
  };
  if (typeof raw.bg === 'string') scene.bg = raw.bg;
  if (typeof raw.bgm === 'string') scene.bgm = raw.bgm;
  if (typeof raw.next === 'string') scene.next = raw.next;

  if (raw.screen !== undefined) {
    if (raw.screen !== 'adv' && raw.screen !== 'chat') {
      throw new ScenarioError(file, raw.id, null, 'screen は adv か chat で書いてください');
    }
    scene.screen = raw.screen;
  }
  if (raw.with !== undefined) {
    if (typeof raw.with !== 'string' || !VALID_CHARACTER_IDS.has(raw.with)) {
      throw new ScenarioError(file, raw.id, null, `with "${String(raw.with)}" は未定義のキャラクターです`);
    }
    scene.with = raw.with as CharacterId;
  }
  if (scene.screen === 'chat' && !scene.with) {
    throw new ScenarioError(file, raw.id, null, 'screen: chat のシーンには with（チャット相手）が必要です');
  }
  return scene;
}

/**
 * ファイルパス → YAML文字列 の対応から、全シーンを構築する。
 * 1ファイルに複数シーンを書けるよう、トップレベルは配列とする。
 */
export function buildScenes(files: Record<string, string>): Map<string, Scene> {
  const scenes = new Map<string, Scene>();

  for (const [path, source] of Object.entries(files)) {
    const parsed = yaml.load(source);
    if (!Array.isArray(parsed)) {
      throw new Error(`[シナリオ定義エラー] ${path}: ファイルのトップレベルはシーンの配列にしてください`);
    }
    for (const rawScene of parsed) {
      const scene = parseScene(rawScene, path);
      if (scenes.has(scene.id)) {
        throw new Error(`[シナリオ定義エラー] シーンID "${scene.id}" が重複しています（${path}）`);
      }
      scenes.set(scene.id, scene);
    }
  }

  // goto / next のリンク切れを検出する
  for (const scene of scenes.values()) {
    const targets: string[] = [];
    if (scene.next) targets.push(scene.next);
    for (const node of scene.body) {
      if (node.kind === 'goto') targets.push(node.goto);
      if (node.kind === 'branch') {
        for (const c of node.cases) targets.push(c.goto);
      }
      if (node.kind === 'choice' || node.kind === 'reply') {
        for (const o of node.options) if (o.goto) targets.push(o.goto);
      }
    }
    for (const target of targets) {
      if (!scenes.has(target)) {
        throw new Error(
          `[シナリオ定義エラー] シーン "${scene.id}" が、存在しないシーン "${target}" を参照しています`,
        );
      }
    }
  }

  // スケジュール表から参照されるシーンも同様に検査する。
  // ここが抜けていると「デートを選んだ瞬間に落ちる」という最悪の壊れ方をする。
  const scheduleTargets = [
    ...Object.values(DATE_SCENES).flat(),
    ...Object.values(EXTRA_DATE_SCENES),
    ...MASHIRO_SCENES,
    FILLER_SCENE,
    FINALE_SCENE,
  ];
  for (const target of scheduleTargets) {
    if (!scenes.has(target)) {
      throw new Error(
        `[シナリオ定義エラー] schedule.ts が、存在しないシーン "${target}" を参照しています`,
      );
    }
  }

  return scenes;
}
