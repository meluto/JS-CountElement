import fs from 'fs';
import path from 'path';
import babelParser from '@babel/parser';

// 開始ディレクトリ
const projectRoot = process.argv[2];

// パースエラーの出たファイルパス
const errorFile = [];


// ASTを生成する関数
function generateAST(jsCode) {
  // Babelを使ってASTを生成する
  const ast = babelParser.parse(jsCode, {
    errorRecovery: true,
    sourceType: 'module',
    plugins: ['jsx'], // オプションに合わせて設定
  });
  return ast;
}

// ファイルをASTに変換してJSONファイルを生成する関数
function processFile(filePath) {
  const jsCode = fs.readFileSync(filePath, 'utf8');
  const ast = generateAST(jsCode);

  // ASTをJSONに変換
  const jsonAST = JSON.stringify(ast, null, 2);

  // JSONファイル用ディレクトリを生成
  const dirname = path.join('./toJSON', 'hoge', path.dirname(filePath));
  fs.mkdirSync(dirname, { recursive: true });
  // JSONファイルを生成
  const outputFileName = path.join(dirname, path.basename(filePath, '.js') + '.json');
  // console.log(outputFileName);
  fs.writeFileSync(outputFileName, jsonAST, 'utf8');
}

function searchProject(mainDirectory) {
  var projects = fs.readdirSync(mainDirectory);
  // 続きから出力したい場合のみ実行
  // projects = projects.splice(620); // 例えば10個目でエラー中断した場合引数は(11)

  for (const project of projects) {
    const projectName = path.join(mainDirectory, project);
    // console.log(project);
    traverseDirectory(projectName);
  }
}

function traverseDirectory(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const filePath = path.join(directory, file);
    const fullPath = path.join('./' + filePath);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      if (file !== 'node_modules') {
        traverseDirectory(filePath); // ディレクトリの場合、再帰的に処理
      }
    } else if (path.extname(filePath) === '.js') {
      try {
        processFile(fullPath);
        console.log(filePath);
      } catch {
        errorFile.push(fullPath);
        console.log("ERROR!!");
        continue;
      }
    }
  }
}


// ディレクトリ探索してファイルを配列にまとめる
searchProject(projectRoot);
// console.log(jsFiles);

console.log(errorFile);
console.log('\nAST生成とJSONファイル生成が完了しました。\n\n');