import fs from 'fs';
import path from 'path';
import jp from 'jsonpath';
import { JSONPath as jpplus } from 'jsonpath-plus'; 
import { createObjectCsvWriter } from 'csv-writer';


// 検索する情報を格納するオブジェクト
var results = {
  Max: {
    projectName: null,
    classOfFile: 0,
    isClass: false,
    method: 0,        //
    property: 0,      // 1.Max,Ave
    constructor: 0,   //
    get: 0,           //
    set: 0,           //
    super: 0,         //
    getProto: 0,      //
    setProto: 0,      // 2.Maxのみ
    private: 0,       //
    priVar: 0,        // 3.Max,Ave
    classComp: 0,     //
    classFuncComp: 0, // 4.Maxのみ
    className: 0,     // 5.Maxのみ
    extendWidth: 0,   //
    extendDepth: 0,   // 6.Maxのみ
  },

  Ave: {
    projectName: null,
    classOfFile: 0,
    isClass: false,
    method: 0,
    property: 0,
    private: 0,
    priVar: 0,
  },

  Total: {
    projectName: null,
    Class: 0,         // Aveで割るクラス数
    File: 0,          // Aveで割るファイル数
    isClass: false,
    method: 0,
    property: 0,
    private: 0,
    priVar: 0,
  }
}

var stores = {
  parentChild: [],    // 5.同一クラス名チェック，6.inheritanceに使用
  inheritance: {}
}



// csv出力で使用
const writeData_Max = [];
const writeData_Ave = [];
const writeData_Total = [];


// 関数：指定ディレクトリから各PJの名前とパスを再帰的に取得
function searchProject(mainDirectory) {
  const projects = fs.readdirSync(mainDirectory);
  
  // 続きから出力したい場合のみ実行
  // projects.splice(0, 150); // 例えば10個目でエラー中断した場合引数は(0, 10 - 1)
  
  for (const project of projects) {

    const projectName = path.join(mainDirectory, project);
    console.log(projectName);
    searchJSONFiles(projectName); // JSON検索
    summarizeStores();
    
    // console.log(stores)

    results.Max.projectName = project;
    results.Ave.projectName = project;
    results.Total.projectName = project;
    writeData_Max.push(results.Max);
    writeData_Ave.push(results.Ave);
    writeData_Total.push(results.Total);

    // console.log(results.Prototype);
    // console.log(util.inspect(dataArray.PrototypeList, { maxArrayLength: null }));    
    // console.log(packages.packageList);
    // console.log(writeData_packages);
    initialization(); // 変数の初期化
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
      results.Total.File++;
    }
  }
}


// 関数：JSONファイルを処理して情報を収集
function processJSONFile(filePath) {
  const jsonCode = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  // 分析対象のclass全文
  const query_class = jpplus("$.program.body.[?(@ && @.type=='ClassExpression' || @ && @.type=='ClassDeclaration')]", jsonCode);

  const classCount = Object.keys(query_class).length;
  if (classCount > 0){
    results.Max.isClass = true;
    results.Ave.isClass = true;
    results.Total.isClass = true;

    //  0.ファイル内クラス数
    if (results.Max.classOfFile < classCount){
      results.Max.classOfFile = classCount;
    }
    results.Total.Class += classCount;


    // console.log(query_class.length)
    for (const classCode of query_class) {

      // PJのクラス内で要素の最大値を検索
      function checkMax (currentMax, result) {
        if (currentMax < Object.keys(result).length){
          currentMax = Object.keys(result).length;
        }
        return currentMax;
      }

      // 複雑度用
      function checkMaxComp (currentMax, result) {
        if (currentMax < result){
          currentMax = result;
        }
        return currentMax;
      }

      // PJのクラス内で要素の合計値を足し合わせる
      function addTotal (total, result) {
        total += Object.keys(result).length;
        return total;
      }


      //  1.新規分析
      // メソッド数
      const query_method = jpplus("$..[?(@ && @.type=='ClassMethod' || @ && @.type=='ClassPrivateMethod')]", classCode);
      results.Max.method = checkMax(results.Max.method, query_method);
      results.Total.method = addTotal(results.Total.method, query_method);

      // プロパティ
      const query_property1 = jpplus("$..[?(@ && @.type=='ClassProperty' || @ && @.type=='ClassPrivateProperty')]", classCode); 
      const query_property2 = jpplus("$..[?(@ && @.kind=='constructor')].[?(@ && @.type=='AssignmentExpression')]", classCode);
      const concat_property = query_property1.concat(query_property2);
      results.Max.property = checkMax(results.Max.property, concat_property);
      results.Total.property = addTotal(results.Total.property, concat_property);


      //  2.重複チェック(MAXのみ)
      // constructor
      const query_constructor = jp.query(classCode, "$..[?(@ && @.kind == 'constructor')]");
      results.Max.constructor = checkMax(results.Max.constructor, query_constructor);

      // getter
      const query_get = jp.query(classCode, "$..[?(@ && @.kind == 'get')]");
      results.Max.get = checkMax(results.Max.get, query_get);

      // setter
      const query_set = jp.query(classCode, "$..[?(@ && @.kind == 'set')]");
      results.Max.set = checkMax(results.Max.set, query_set);

      // super
      const query_super = jp.query(classCode, "$..[?(@ && @.type == 'Super')]");
      results.Max.super = checkMax(results.Max.super, query_super);

      // getPrototypeOf()
      const query_getProto = jpplus("$..property^[?(@ && @.name == 'Object' || @ && @.name == 'Reflect')]^[?(@ && @.name == 'getPrototypeOf')]", classCode);
      results.Max.getProto = checkMax(results.Max.getProto, query_getProto);

      // setPrototypeOf()
      const query_setProto = jpplus("$..property^[?(@ && @.name == 'Object' || @ && @.name == 'Reflect')]^[?(@ && @.name == 'setPrototypeOf')]", classCode);
      results.Max.setProto = checkMax(results.Max.setProto, query_setProto);



      //   3.クラス内比較
      // private
      const query_private = jp.query(classCode, "$..[?(@ && @.type == 'ClassPrivateMethod' || @ && @.type == 'ClassPrivateProperty')]");
      results.Max.private = checkMax(results.Max.private, query_private);
      results.Total.private = addTotal(results.Total.private, query_private);

      // private(pri)変数
      //   追加
      const query_priVar1 = jpplus("$..[?(@ && @.type=='ClassMethod' || @ && @.type=='ClassProperty')].key..name", classCode);
      const query_priVar2 = jpplus("$..[?(@ && @.kind=='constructor')].[?(@ && @.type=='AssignmentExpression')].*.name", classCode);
      const concat_priVar = query_priVar1.concat(query_priVar2);
      const filter_priVar = concat_priVar.filter((word) => word.startsWith('_') && (word !== '_'));
      results.Max.priVar = checkMax(results.Max.priVar, filter_priVar);  
      results.Total.priVar = addTotal(results.Total.priVar, filter_priVar);
 


      //   4.クラス複雑度
      var classComp = 0;
      var repeatCode = classCode; 
      while (Object.keys(repeatCode).length > 0){
        repeatCode = jpplus("$.*..[?(@ && @.type=='ClassExpression' || @ && @.type=='ClassDeclaration')]", repeatCode);
        classComp++;
      }
      results.Max.classComp = checkMaxComp(results.Max.classComp, classComp);

      //   4.クラス&関数複雑度
      var classFuncComp = 0;
      repeatCode = classCode; 
      while (Object.keys(repeatCode).length > 0){
        repeatCode = jpplus("$.*..[?(@ && @.type=='ClassExpression' || @ && @.type=='ClassDeclaration' || @ && @.type=='FunctionDeclaration' || @ && @.type=='FunctionExpression' || @ && @.type=='ClassMethod')]", repeatCode);
        classFuncComp++;
      }
      results.Max.classFuncComp = checkMaxComp(results.Max.classFuncComp, classFuncComp);


      //    5,6 .クラスの継承関係を配列形式で格納
      const query_extendsName = jpplus("$.superClass.name", classCode);
      const query_className = jpplus("$.id.name", classCode);

      stores.parentChild.push([query_extendsName[0], query_className[0]]); // 親クラス名を配列[0]，子クラス名を配列[1]に格納
    }
  }
}


// Totalやstoresのデータから結果を求める
function summarizeStores () {
  // 要素の合計値からPJの平均値を求める
  for (const element in results.Total) {
    if (element !== 'projectName' && element !== 'Class' && element !== 'File' && element !== 'isClass') {
      results.Ave[element] = results.Total[element] / results.Total.Class;
    }
    results.Ave.classOfFile = results.Total.Class / results.Total.File;
  }


  //   5.同一クラス名数チェック(MAXのみ)
  // リストの作成
  const counts = {};
  for (const key of stores.parentChild){
    // var className = counts[key[1]];
    if (counts[key[1]]) {
      counts[key[1]]++;
    } else {
      counts[key[1]] = 1;
    }
  }

  // 最大回数の検索
  for (const key in counts) {
    if ((results.Max.className < counts[key]) && (key !== "undefined")) {
      results.Max.className = counts[key];
    }
  }


  //   6.継承による親子関係情報の配列からプロトタイプチェーン形式で再現
  var check = [];
  var cutParChi = stores.parentChild;
  // 配列を順番に読み込み、オブジェクトを検索して値を設定
  // 先に最上位クラスを格納
  for (const key of cutParChi){
    var [parent, child] = key;
    if (parent === undefined){
        stores.inheritance[`${child}`] = {};
        cutParChi = cutParChi.filter(n => n !== key);
        check.push(child)
    }
  };
  // console.log(inheritance)

  // 後に親子クラスを深さ優先で格納
  function checkParent(obj, item) {
    // console.log(obj)
    check = [];
    for (const key of cutParChi){ // リストのループ
        [parent, child] = key;
      if (parent === item){
        obj[`${child}`] = {};
        cutParChi = cutParChi.filter(n => n !== key);
        check.push(child)
      }
    }
    if (check.length > 0){
      // console.log(check)
      for (const item of check){
        if (checkParent(obj[item], item)){
          return true;
        }
      }
    } else {
      return false;
    }
    return false;
  }
  // 関数の呼び出し部
  for (const item of check){ // 格納したクラス名のループ
    checkParent(stores.inheritance[item], item)
  }

  // 親子関係のないものを格納
  for (const key of cutParChi){
    var [parent, child] = key;
    stores.inheritance[`${parent}`] = {};
    stores.inheritance[`${parent}`][`${child}`] = {};
  };

  // 継承関係のフル表示
  // console.log(JSON.stringify(stores.inheritance,null,'\t'));



  //   6.クラスの継承の幅と深さを計算
  function getMaxDepthAndWidth(obj, maxDepth) {
    if (obj === null) {
      return { maxDepth: 0, maxWidth: 0 };
    }
  
    const keys = Object.keys(obj);
    var maxDepth = 0;
    var maxWidth = keys.length
  
    for (const key of keys) {
      const value = obj[key];
      const depthAndWidth = getMaxDepthAndWidth(value);
      maxDepth = Math.max(maxDepth, depthAndWidth.maxDepth + 1);
      maxWidth = Math.max(maxWidth, depthAndWidth.maxWidth);
    }
    return { maxDepth, maxWidth };
  }
  const { maxDepth, maxWidth } = getMaxDepthAndWidth(stores.inheritance);
  results.Max.extendDepth = maxDepth;
  results.Max.extendWidth = maxWidth;
}


// 関数：リストの初期化
function initialization () {
  results = {
    Max: { projectName: null, classOfFile: 0, isClass: false,
      method: 0, property: 0, 
      constructor: 0, get: 0, set: 0, super: 0, getProto: 0, setProto: 0, 
      private: 0, priVar: 0, 
      classComp: 0, classFuncComp: 0, 
      className: 0, extendWidth: 0, extendDepth: 0,
    },
    Ave: { projectName: null, classOfFile: 0, isClass: false, method: 0, property: 0, private: 0, priVar: 0 },
    Total: { projectName: null, Class: 0, File: 0, isClass: false, method: 0, property: 0, private: 0, priVar: 0 },
  }
  
  stores = { parentChild: [], inheritance: {} }
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
const csvWriter_Max = createObjectCsvWriter({
  path: `./csv/${path.basename(rootDirectory)}_classMax_${("0" + d).slice(-6)}.csv`, // クエリ種類をファイル名にする
  header: [
    {id: 'projectName' , title: 'プロジェクト名'},
    {id: 'classOfFile' , title: 'ファイル別最大クラス数'},
    {id: 'isClass' , title: 'クラス型'},
    {id: 'method', title: '最大method'},
    {id: 'property', title: '最大property'},
    {id: 'constructor', title: '重複constructor'},
    {id: 'get', title: '重複get'},
    {id: 'set', title: '重複set'},
    {id: 'super', title: '重複super'},
    {id: 'getProto', title: '重複getProto'},
    {id: 'setProto', title: '重複setProto'},
    {id: 'private', title: '最大#private'},
    {id: 'priVar', title: '最大_pri変数'},
    {id: 'classComp', title: '最大クラス複雑度'},
    {id: 'classFuncComp', title: '最大クラス関数複雑度'},
    {id: 'className', title: '同一クラス名数'},
    {id: 'extendWidth', title: '最大継承幅'},
    {id: 'extendDepth', title: '最大継承深さ'},
  ]
})

const csvWriter_Ave = createObjectCsvWriter({
  path: `./csv/${path.basename(rootDirectory)}_classAve_${("0" + d).slice(-6)}.csv`, // クエリ種類をファイル名にする
  header: [
    {id: 'projectName' , title: 'プロジェクト名'},
    {id: 'classOfFile' , title: 'ファイル別平均クラス数'},
    {id: 'isClass' , title: 'クラス型'},
    {id: 'method', title: '平均method'},
    {id: 'property', title: '平均property'},
    {id: 'private', title: '平均#private'},
    {id: 'priVar', title: '平均_pri変数'},
  ]
})

const csvWriter_Total = createObjectCsvWriter({
  path: `./csv/${path.basename(rootDirectory)}_classTotal_${("0" + d).slice(-6)}.csv`, // クエリ種類をファイル名にする
  header: [
    {id: 'projectName' , title: 'プロジェクト名'},
    {id: 'Class', title: '合計クラス数'},
    {id: 'File', title: '合計ファイル数'},
    {id: 'isClass' , title: 'クラス型'},
    {id: 'method', title: '合計method'},
    {id: 'property', title: '合計property'},
    {id: 'private', title: '合計#private'},
    {id: 'priVar', title: '合計_pri変数'},
  ]
})


await csvWriter_Max.writeRecords(writeData_Max).then(() => { console.log('\nsuccess(writeMax)') })
await csvWriter_Ave.writeRecords(writeData_Ave).then(() => { console.log('success(writeAve)') })
await csvWriter_Total.writeRecords(writeData_Total).then(() => { console.log('success(writeTotal)') })