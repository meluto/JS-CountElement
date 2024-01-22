import fs from 'fs';
import path from 'path';
import jp from 'jsonpath';
import { JSONPath as jpplus } from 'jsonpath-plus'; 
import { createObjectCsvWriter } from 'csv-writer';
import util from 'util';


// 検索する情報を格納するオブジェクト
var results = {
  projectName: null,
  static: 0,
  constructor: 0,
  private: 0,
  get: 0,
  set: 0,
  super: 0,
  Prototype: 0,
  Proto: 0,
  getProto: 0,
  setProto: 0,
  create: 0,
  priVar: 0,  // 不要かも
};

// var dataArray = {
//   PrototypeList: [],
// };

// csv出力で使用
const writeData_results = [];


// 関数：指定ディレクトリから各PJの名前とパスを再帰的に取得
function searchProject(mainDirectory) {
  const projects = fs.readdirSync(mainDirectory);
  
  // 続きから出力したい場合のみ実行
  // projects.splice(0, ); // 例えば10個目でエラー中断した場合引数は(0, 10 - 1)
  
  for (const project of projects) {
    const projectName = path.join(mainDirectory, project);
    console.log(projectName);
    searchJSONFiles(projectName); // JSON検索
    
    results.projectName = project;
    writeData_results.push(results);

    // console.log(results.Prototype);
    // console.log(util.inspect(dataArray.PrototypeList, { maxArrayLength: null }));    
    // console.log(packages.packageList);
    // console.log(writeData_packages);
    initialization();
  }
}

// 関数：指定ディレクトリからJSONファイルを再帰的に探索
function searchJSONFiles(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      searchJSONFiles(filePath); // ディレクトリの場合、再帰的に探索
    } else if (path.extname(filePath) === '.json') {
      processJSONFile(filePath); // JSONファイルを処理
    }
  }
}


// 関数：JSONファイルを処理して情報を収集
function processJSONFile(filePath) {
  const jsonCode = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // サイトでは '@' -> '@ && @'　に変換して行う
  // static
  const query_static1 = jp.query(jsonCode, "$..[?(@ && @.static)]");
  const query_static2 = jp.query(jsonCode, "$..[?(@ && @.type == 'StaticBlock')]");
  results.static += Object.keys(query_static1).length;
  results.static += Object.keys(query_static2).length;

  // constructor
  const query_constructor = jp.query(jsonCode, "$..[?(@ && @.kind == 'constructor')]");
  results.constructor += Object.keys(query_constructor).length;

  // private
  const query_private = jp.query(jsonCode, "$..[?(@ && @.type == 'ClassPrivateProperty')]");
  results.private += Object.keys(query_private).length;

  // getter
  const query_get = jp.query(jsonCode, "$..[?(@ && @.kind == 'get')]");
  results.get += Object.keys(query_get).length;

  // setter
  const query_set = jp.query(jsonCode, "$..[?(@ && @.kind == 'set')]");
  results.set += Object.keys(query_set).length;

  // super
  const query_super = jp.query(jsonCode, "$..[?(@ && @.type == 'Super')]");
  results.super += Object.keys(query_super).length;

  // prototype代入
  const query_Prototype1 = jpplus("$..[?(@ && @.type == 'AssignmentExpression')]..property^[?(@ && @.name == 'prototype')]", jsonCode);
  const query_Prototype2 = jpplus("$..property^[?(@ && @.name == 'prototype')]", jsonCode);
  const Prototype = Object.keys(query_Prototype1).filter(key => query_Prototype2.hasOwnProperty(key))
    .reduce((obj, key) => {
        obj[key] = query_Prototype1[key];
        return obj;
    }, {});
  results.Prototype += Object.keys(Prototype).length;

  // __proto__
  const query_Proto1 = jpplus("$..key^[?(@ && @.name == '__proto__')]", jsonCode);
  const query_Proto2 = jpplus("$..property^[?(@ && @.name == '__proto__')]", jsonCode);
  results.Proto += Object.keys(query_Proto1).length;
  results.Proto += Object.keys(query_Proto2).length;

  // getPrototypeOf()
  const query_getProto = jpplus("$..property^[?(@ && @.name == 'Object' || @ && @.name == 'Reflect')]^[?(@ && @.name == 'getPrototypeOf')]", jsonCode);
  results.getProto += Object.keys(query_getProto).length;

  // setPrototypeOf()
  const query_setProto = jpplus("$..property^[?(@ && @.name == 'Object' || @ && @.name == 'Reflect')]^[?(@ && @.name == 'setPrototypeOf')]", jsonCode);
  results.setProto += Object.keys(query_setProto).length;

  // create()
  const query_create = jpplus("$..property^[?(@ && @.name == 'Object')]^[?(@ && @.name == 'create')]", jsonCode);
  results.create += Object.keys(query_create).length;

  // private(pri)変数
  //   追加
  const query_priVar1 = jpplus("$.program.body.[?(@ && @.type=='AssignmentExpression')].left..name", jsonCode); // 代入変数
  const query_priVar2 = jpplus("$.program.body.[?(@ && @.type=='VariableDeclarator')].id..name", jsonCode); // 初期化変数
  const query_priVar3 = jpplus("$.program.body.[?(@ && @.type=='ClassProperty')].key..name", jsonCode); // クラス内代入変数(初期化，プロパティは不可)
  const filter_priVar1 = query_priVar1.filter((word) => word.startsWith('_') && (word !== '_'));
  const filter_priVar2 = query_priVar2.filter((word) => word.startsWith('_') && (word !== '_'));
  const filter_priVar3 = query_priVar3.filter((word) => word.startsWith('_') && (word !== '_'));
  results.priVar += Object.keys(filter_priVar1).length;
  results.priVar += Object.keys(filter_priVar2).length;
  results.priVar += Object.keys(filter_priVar3).length;
}

// 関数：リストの初期化
function initialization(){
  results = {
    projectName: null, 
    static: 0, 
    constructor: 0,
    private: 0,
    get: 0,
    set: 0,
    super: 0,
    Prototype: 0,
    Proto: 0,
    getProto: 0,
    setProto: 0,
    create: 0,
    priVar: 0,
  }
}



// メインの処理
const rootDirectory = process.argv[2]; // プロジェクトのルートディレクトリを指定
searchProject(rootDirectory); // ディレクトリ用
// processJSONFile(rootDirectory); // 単一ファイル用


// デバッグ用console
// console.log(dataArray.classList);
// console.log(dataArray.funcList);
// console.log(dataArray.libList);
// console.log(dataArray.newList);
// console.log(packages.packageList);

const d = Date.now();
const csvWriter_results = createObjectCsvWriter({
  path: `./csv/${path.basename(rootDirectory)}_element_${("0" + d).slice(-6)}.csv`, // クエリ種類をファイル名にする
  header: [
    {id: 'projectName' , title: 'プロジェクト名'},
    {id: 'static', title: 'static'},
    {id: 'constructor', title: 'constructor()'},
    {id: 'private', title: 'privateクラス'},
    {id: 'get', title: 'getter'},
    {id: 'set', title: 'setter'},
    {id: 'super', title: 'super()'},
    {id: 'Prototype', title: 'prototype'},
    {id: 'Proto', title: '__proto__'},
    {id: 'getProto', title: 'getPrototypeOf()'},
    {id: 'setProto', title: 'setPrototypeOf()'},
    {id: 'create', title: 'create()'},
    {id: 'priVar', title: 'private変数'}
  ]
})

await csvWriter_results.writeRecords(writeData_results).then(() => {
  console.log('\nsuccess(writeResults)')
})