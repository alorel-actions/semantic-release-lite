import InputMgr, {InputMgrInit} from './input-mgr.mjs';
import TypesInputParser from './types-input-parser.mjs';

export interface CommonConfig {
  'breaking-change-keywords': string[];

  'minor-types': Set<string>;

  'patch-types': Set<string>;

  'stay-at-zero': boolean;

  'trivial-types': Set<string>;
}

function commonConfigInit<T>(typeInpParser?: TypesInputParser<T>): InputMgrInit<CommonConfig>;
function commonConfigInit(typeInpParser?: TypesInputParser<any>): InputMgrInit<CommonConfig>;
function commonConfigInit(typeInpParser = new TypesInputParser<CommonConfig>()): InputMgrInit<CommonConfig> {
  return {
    'breaking-change-keywords': [InputMgr.ARRAY, {required: true}],
    'minor-types': typeInpParser.createParser('minor-types'),
    'patch-types': typeInpParser.createParser('patch-types'),
    'trivial-types': typeInpParser.createParser('trivial-types'),
    'stay-at-zero': Boolean,
  };
}

export {commonConfigInit};
