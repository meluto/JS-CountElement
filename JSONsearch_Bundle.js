import fs from 'fs';
import path from 'path';
import jp from 'jsonpath';
import { JSONPath as jpplus } from 'jsonpath-plus'; 
import { createObjectCsvWriter } from 'csv-writer';
import { defObject } from './data.js';


// 検索する情報を格納するオブジェクト
var results = {
  projectName: null,
  class: 0,
  extend: 0,
  importCount: 0,
  import: 0,
  require: 0,
  package: 0,
};

var newType = {
  projectName: null,
  total: 0,
  C: 0,
  R: 0,
  F: 0,
  O: 0,
  L: 0,
}

var createType = {
  projectName: null,
  total: 0,
  C: 0,
  R: 0,
  F: 0,
  O: 0,
  L: 0,
}

// 1-2で使用
var dataArray = {
  newList: [],
  createList: [],
  classList: [new Set()],
  funcList: [new Set()],
  libList: [new Set()],
  defObjectList: defObject, // 初期化しない
};

// 2-2で使用
var packages = {
  projectName: null,
  packageList: [],
}

// csv出力で使用
const writeData_results = [];
const writeData_newType = [];
const writeData_createType = [];
const writeData_packages = [];




// 関数：指定ディレクトリから各PJの名前とパスを再帰的に取得
function searchProject(mainDirectory) {
  const projects = fs.readdirSync(mainDirectory);
  
  // 続きから出力したい場合のみ実行
  // projects.splice(0, 17); // 例えば10個目でエラー中断した場合引数は(0, 10 - 1)
  
  for (const project of projects) {
    const projectName = path.join(mainDirectory, project);
    console.log(projectName);
    searchJSONFiles(projectName); // JSON検索
    results.importCount = (results.import + results.require);

    typeCheck(dataArray.newList, newType); // 1-2用
    typeCheck(dataArray.createList, createType); // 1-3用
    packages.packageList.sort(); // 2-2の結果並べ替え
    
    results.projectName = project;
    newType.projectName = project;
    createType.projectName = project;
    packages.projectName = project;
    writeData_results.push(results);
    writeData_newType.push(newType);
    writeData_createType.push(createType);
    writeData_packages.push(packages);

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
      try {
        processJSONFile(filePath); // JSONファイルを処理
      } catch {
        console.log("ERROR!!"); 
        continue;
      }
    }
  }
}


// 関数：JSONファイルを処理して情報を収集
function processJSONFile(filePath) {
  const jsonCode = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  //   1-1
  // サイトでは '@' -> '@ && @'　に変換して行う
  // クラス定義
  const query_class1 = jpplus("$.program.body.[?(@ && @.type=='ClassDeclaration')].id.name", jsonCode); // 通常のclass || 特殊class定義
  const query_class3 = jpplus("$.program.body.[?(@ && @.type!='NewExpression')][?(@ && @.type=='ClassExpression')]^left.name", jsonCode); // class代入
  const query_class4 = jpplus("$.program.body.[?(@ && @.type!='NewExpression')][?(@ && @.type=='ClassExpression')]^left..object.name", jsonCode); // プロパティに代入
  const query_class5 = jpplus("$.program.body.[?(@ && @.type!='NewExpression')][?(@ && @.type=='ClassExpression')]^id.name", jsonCode); // class初期化代入
  dataArray.classList.push(...query_class1);
  dataArray.classList.push(...query_class3);
  dataArray.classList.push(...query_class4);
  dataArray.classList.push(...query_class5);
  results.class += Object.keys(query_class1).length;
  results.class += Object.keys(query_class3).length;
  results.class += Object.keys(query_class4).length;
  results.class += Object.keys(query_class5).length;  

  // 継承
  const query_extend1 = jpplus("$.program.body.[?(@ && @.type=='ClassExpression' || @ && @.type=='ClassDeclaration')].superClass.name", jsonCode); // 通常の継承（カウント用）
  const query_extend2 = jpplus("$.program.body.[?(@ && @.type=='ClassExpression' || @ && @.type=='ClassDeclaration')].superClass.property.name", jsonCode); // プロトタイプチェーンの継承（カウント用）
  results.extend += Object.keys(query_extend1).length;
  results.extend += Object.keys(query_extend2).length;



  //   1-2
  // new
  const query_new1 = jpplus("$.program.body.[?(@ && @.type=='VariableDeclarator' || @ && @.type=='AssignmentExpression')][?(@ && @.type=='NewExpression')].callee.name", jsonCode); // 初期化した変数にnew代入
  const query_new2 = jpplus("$.program.body.[?(@ && @.type=='VariableDeclarator')].[?(@ && @.type=='MemberExpression')][?(@ && @.type=='NewExpression')].callee.name", jsonCode); // プロパティメソッドのついているオブジェクトでnew代入
  const query_new3 = jpplus("$.program.body.[?(@ && @.type=='NewExpression')][?(@ && @.type=='MemberExpression')]..object.name", jsonCode); // プロパティのついているオブジェクトでnew代入
  dataArray.newList.push(...query_new1);
  dataArray.newList.push(...query_new2);
  dataArray.newList.push(...query_new3);
  newType.total += Object.keys(query_new1).length;
  newType.total += Object.keys(query_new2).length;
  newType.total += Object.keys(query_new3).length;

  // create()
  const query_create1 = jpplus("$..property^[?(@ && @.name == 'Object')]^[?(@ && @.name == 'create')]^^^^^arguments.*.name", jsonCode); // 初期化変数，変数代入にcreate()
  const query_create2 = jpplus("$..property^[?(@ && @.name == 'Object')]^[?(@ && @.name == 'create')]^^^^^arguments.*.object.name", jsonCode); // プロパティメソッドのついている変数にcreate()
  dataArray.createList.push(...query_create1);
  dataArray.createList.push(...query_create2);
  createType.total += Object.keys(query_create1).length;
  createType.total += Object.keys(query_create2).length;

  // 無名クラス，無名関数（インスタンス化カウント）
  const query_noNameNew1 = jpplus("$.program.body.[?(@ && @.type=='NewExpression')][?(@ && @.type=='ClassExpression')]", jsonCode); // 無名クラスの即時new
  const query_noNameNew2 = jpplus("$.program.body.[?(@ && @.type=='NewExpression')][?(@ && @.type=='FunctionExpression')]", jsonCode); // 無名function関数の即時new
  results.class += Object.keys(query_noNameNew1).length;
  newType.total += Object.keys(query_noNameNew1).length;
  newType.total += Object.keys(query_noNameNew2).length;
  newType.C += Object.keys(query_noNameNew1).length;
  newType.F += Object.keys(query_noNameNew2).length;

  // function
  const query_function1 = jp.query(jsonCode, "$.program.body..[?(@.type=='FunctionDeclaration')].id.name"); // 通常のfunction
  const query_function3 = jpplus("$.program.body.[?(@ && @.type!='NewExpression')][?(@ && @.type=='FunctionExpression')]^^left.name", jsonCode); // function代入
  const query_function4 = jpplus("$.program.body.[?(@ && @.type!='NewExpression')][?(@ && @.type=='FunctionExpression')]^^left..object.name", jsonCode); // プロパティに代入
  const query_function5 = jpplus("$.program.body.[?(@ && @.type!='NewExpression')][?(@ && @.type=='FunctionExpression')]^^^^^^id.name", jsonCode); // function初期化代入(プロパティメソッドを含めない場合^2つ)
  dataArray.funcList.push(...query_function1);
  dataArray.funcList.push(...query_function3);
  dataArray.funcList.push(...query_function4);
  dataArray.funcList.push(...query_function5);

  // アロー関数
  const query_arrowFunc1 = jpplus("$.[?(@ && @.type == 'ArrowFunctionExpression')]^left.name", jsonCode); // アロー関数代入
  const query_arrowFunc2 = jpplus("$.[?(@ && @.type == 'ArrowFunctionExpression')]^left..object.name", jsonCode); // プロパティにアロー関数代入
  const query_arrowFunc3 = jpplus("$.[?(@ && @.type=='ArrowFunctionExpression')]^id.name", jsonCode); // アロー関数初期化代入
  dataArray.funcList.push(...query_arrowFunc1);
  dataArray.funcList.push(...query_arrowFunc2);
  dataArray.funcList.push(...query_arrowFunc3);

  // import名
  const query_importName = jp.query(jsonCode, "$.program.body..[?(@.type=='ImportDeclaration')].specifiers..local.name"); // 通常のimport
  dataArray.libList.push(...query_importName);

  // require名
  const query_reqName1 = jpplus("$.program.[?(@ && @.name=='require')]^^^^..left.name", jsonCode); // 定義済み変数にrequire代入
  const query_reqName2 = jpplus("$.program.[?(@ && @.name=='require')]^^^^..left..object.name", jsonCode); // プロパティにrequire代入 
  const query_reqName3 = jpplus("$.program.[?(@ && @.name=='require')]^^^^..id.name", jsonCode); // 初期化変数にnew代入
  dataArray.libList.push(...query_reqName1);
  dataArray.libList.push(...query_reqName2);
  dataArray.libList.push(...query_reqName3);




  //   2-1
  // importパッケージ名
  const query_imports = jp.query(jsonCode, "$.program.body[?(@.type == 'ImportDeclaration')].source.value");
  const filter_imports = query_imports.filter((element) => !element.toString().includes('./') && !element.toString().includes('../'));  // './'または'../'から始まるパッケージ名を取り除く
  packageCheck(filter_imports);
  results.import += Object.keys(filter_imports).length;

  // requireパッケージ名
  const query_requires1 = jpplus("$.program.[?(@ && @.name=='require')]^arguments.*.value", jsonCode);
  const query_requires2 = jpplus("$.program.[?(@ && @.name=='require')]^^^arguments.*.value", jsonCode); // artifacts.require等の取得
  const filter_requires1 = query_requires1.filter((element) => !element.toString().includes('./') && !element.toString().includes('../'));
  const filter_requires2 = query_requires2.filter((element) => !element.toString().includes('./') && !element.toString().includes('../')); // './'または'../'から始まるパッケージ名を取り除く
  packageCheck(filter_requires1);
  packageCheck(filter_requires2);
  results.require += Object.keys(filter_requires1).length;
  results.require += Object.keys(filter_requires2).length;


  // 2-2
  // パッケージの重複チェック
  function packageCheck(libraries){
    // 連想配列のキーとパッケージ名を比較して更新
    for (const library of libraries){
      let found = false;
      var splitLib = [];
      if (typeof library !== 'number') {
        splitLib = library.split('/')
      } else {
        splitLib.push(library)
      }
      
      for (const key of packages.packageList) {
        if (key === splitLib[0]) {
          found = true;
          break;
        }
      }
      // パッケージ名が見つからなければ新たに追加
      if (!found) {
        packages.packageList.push(splitLib[0]);
        results.package++;
      }
    }
  }
}


// 1-2, 1-3で使用するnewオブジェクトの型判別
function typeCheck(Lists, Type){
  for (const newKey of Lists) {
    let found = false;

    for (const classKey of dataArray.classList) {
      if (newKey === classKey) {
        Type.C++;
        found = true;
        break;
      }
    }
    if (!found) {
      for (const funcKey of dataArray.funcList) {
        if (newKey === funcKey) {
          Type.F++;
          found = true;
          break;
        }
      }
    }
    if (!found) {
      for (const libKey of dataArray.libList) {
        if (newKey === libKey) {
          Type.L++;
          found = true;
          break;
        }
      }
    }
    if (!found) {
      for (const objKey of dataArray.defObjectList) {
        if (newKey === objKey) {
          Type.O++;
          found = true;
          break;
        }
      }
    }
    if (!found){
      Type.R++;
    }
  }
}

// 関数：リストの初期化
function initialization(){
  results = { projectName: null, class: 0, extend: 0, importCount: 0, import: 0, require: 0, package: 0, };
  newType = { projectName: null, total: 0, C: 0, R: 0, F: 0, O: 0, L: 0, }
  createType = { projectName: null, total: 0, C: 0, R: 0, F: 0, O: 0, L: 0, }
  dataArray = { newList: [], createList: [], classList: [new Set()], funcList: [new Set()], libList: [new Set()], defObjectList: defObject};
  packages = { projectName: null, packageList: [], };
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
  path: `./csv/${path.basename(rootDirectory)}_result_${("0" + d).slice(-6)}.csv`, // クエリ種類をファイル名にする
  header: [
    {id: 'projectName' , title: 'PJ名'},
    {id: 'class', title: 'クラス定義'},
    {id: 'extend', title: '継承'},
    {id: 'importCount', title: 'インポート数'},
    {id: 'import', title: 'import回数'},
    {id: 'require', title: 'require回数'},
    {id: 'package', title: 'pkg種類'},
  ]
})

const csvWriter_packages = createObjectCsvWriter({
  path: `./csv/${path.basename(rootDirectory)}_package_${("0" + d).slice(-6)}.csv`, // クエリ種類をファイル名にする
  header: [
    {id: 'projectName' , title: 'プロジェクト名'},
    {id: 'packageList', title: 'パッケージ名'},
  ]
})

const csvWriter_newType = createObjectCsvWriter({
  path: `./csv/${path.basename(rootDirectory)}_newType_${("0" + d).slice(-6)}.csv`, // クエリ種類をファイル名にする
  header: [
    {id: 'projectName' , title: 'PJ名'},
    {id: 'total', title: 'new数'},
    {id: 'C', title: 'C'},
    {id: 'R', title: 'R'},
    {id: 'F', title: 'F'},
    {id: 'O', title: 'O'},
    {id: 'L', title: 'L'}, 
  ]
})

const csvWriter_createType = createObjectCsvWriter({
  path: `./csv/${path.basename(rootDirectory)}_createType_${("0" + d).slice(-6)}.csv`, // クエリ種類をファイル名にする
  header: [
    {id: 'projectName' , title: 'PJ名'},
    {id: 'total', title: 'create()数'},
    {id: 'C', title: 'C'},
    {id: 'R', title: 'R'},
    {id: 'F', title: 'F'},
    {id: 'O', title: 'O'},
    {id: 'L', title: 'L'}, 
  ]
})

try {
  await csvWriter_results.writeRecords(writeData_results).then(() => { console.log('\nsuccess(writeResults)') })
  await csvWriter_newType.writeRecords(writeData_newType).then(() => { console.log('success(writeNewType)') })
  await csvWriter_createType.writeRecords(writeData_createType).then(() => { console.log('success(writeCreateType)') })
  await csvWriter_packages.writeRecords(writeData_packages).then(() => { console.log('success(writePackages)') })
} catch {
  console.log(writeData_results);
  console.log(writeData_packages);
}