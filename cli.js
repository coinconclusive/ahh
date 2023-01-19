#!/usr/bin/env node

const process = require('process')
const fs = require('fs');
const path = require('path');
const fm = require('front-matter');
const marked = require('marked');
// const { Console } = require('console');
// const console = new Console({
//   stdout: process.stdout,
//   stderr: process.stderr,
//   colorMode: "auto",
//   groupIndentation: 2
// });

console.log("\033[32mahh\033[0m, you need a blog! will do :)");

const configFile = './ahh.json';

if(!fs.existsSync(configFile) || !fs.statSync(configFile).isFile()) {
  console.error(`config file not found (${configFile}), aborting.`);
  process.exit(1);
}

console.log(`Found config file: ${configFile}`);

/**
 * @type {{
 *   public: string,
 *   sources: string,
 *   blog: string,
 *   template: { blog: string, static: string[] }
 *   index: { source: string, html: string }
 * }} 
*/
const configJson = JSON.parse(fs.readFileSync(configFile).toString());

/**
 * @param {object} o object
 * @param {string} k path
 */
function checkObjectKey(o, k, prefix = '') {
  const i = k.indexOf('.');
  if(i > 0) {
    checkObjectKey(o, k.slice(0, i), prefix);
    checkObjectKey(
      o[k.slice(0, i)],
      k.slice(i + 1),
      prefix + (prefix ? '.' : '') + k.slice(0, i)
    );
  } else if(!o[k]) {
    console.error(`missing required key: '${prefix}${prefix?'.':''}${k}', aborting.`);
    process.exit(1);
  }
}

checkObjectKey(configJson, `sources`);
checkObjectKey(configJson, `public`);
checkObjectKey(configJson, `blog`);
checkObjectKey(configJson, `index.source`);
checkObjectKey(configJson, `index.html`);
checkObjectKey(configJson, `template.blog`);

const config = {
  sourcesDir: configJson.sources,
  publicDir: configJson.public,
  blogDir: configJson.blog,
  sourceIndex: configJson.index.source,
  htmlIndex: configJson.index.html,
  blogTemplate: path.join(configJson.sources, configJson.template.blog),
  staticTemplateExts: configJson.template.static,
};
console.log(`sources: ${config.sourcesDir}`);
console.log(`public: ${config.publicDir}`);
console.log(`blog: ${path.join(config.sourcesDir, config.blogDir)}`);

const sources = [];
console.group(`Reading sources from ${config.sourcesDir}`);
for(const file of fs.readdirSync(config.sourcesDir)) {
  const fileFull = path.join(config.sourcesDir, file);
  console.group(`Indexing file ${fileFull}`);
  if(file == path.basename(config.blogDir)) {
    console.log(`Blog directory (${file}), skipping.`);
    console.groupEnd();
    continue;
  }
  sources.push(file);
  console.groupEnd();
}

  /**
 * @type {{[id: string]: {
 *   author: string,
 *   date: Date,
 *   title: string,
 *   description: string,
 *   id: string,
 *   html: string,
 *   files: string[]
 * }}}
 */
const postIndex = {};

console.group(`Reading blog sources from ${path.join(config.sourcesDir, config.blogDir)}`);
for(const blogDir of fs.readdirSync(path.join(config.sourcesDir, config.blogDir))) {
  const fullBlogDir = path.join(config.sourcesDir, config.blogDir, blogDir);
  if(fs.statSync(fullBlogDir).isDirectory()) {
    console.log(`- blog post: ${blogDir} (${fullBlogDir})`);
    const sourceIndexFile = path.join(fullBlogDir, config.sourceIndex);
    if(!fs.existsSync(sourceIndexFile)
    || !fs.statSync(sourceIndexFile).isFile()) {
      console.error("source index file not found, skipping.");
      continue;
    }
    const source = fs.readFileSync(sourceIndexFile).toString();
    const { attributes, body } = fm(source);
    const html = marked.marked(body);
    
    checkObjectKey(attributes, 'author', '[post metadata]');
    checkObjectKey(attributes, 'description', '[post metadata]');
    checkObjectKey(attributes, 'date', '[post metadata]');
    checkObjectKey(attributes, 'author', '[post metadata]');

    const metadata = {
      title: attributes.title,
      description: attributes.description,
      date: new Date(attributes.date),
      author: attributes.author,
    };

    const files = [];
    for(const f of fs.readdirSync(fullBlogDir)) {
      files.push(f);
    }

    postIndex[blogDir] = { id: blogDir, html, files, ...metadata };
  }
}

function remkdirMaybeSync(p) {
  let remake = false;
  if(fs.existsSync(p)) {
    if(!fs.statSync(p).isDirectory()) {
      console.error(`${p} is not a directory`);
      process.exit(1);
    }
    console.log(`Removing directory ${p}`);
    fs.rmSync(p, { force: true, recursive: true });
    remake = true;
  }
  console.log(`${remake ? `Recreating` : `Creating`} directory ${p}`);
  fs.mkdirSync(p);
}

function mkdirMaybeSync(p) {
  if(!fs.existsSync(p)) {
    fs.mkdirSync(p);
  } else if(!fs.statSync(p).isDirectory()) {
    console.error(`${p} is not a directory`);
    process.exit(1);
  }
}

if(!fs.existsSync(config.blogTemplate) || !fs.statSync(config.blogTemplate).isFile()) {
  console.error(`Blog template file not found (${config.blogTemplate}), aborting`);
  process.exit(1);
} else {
  console.log(`Blog template file found (${config.blogTemplate})`);
}

console.groupEnd();
console.groupEnd();
console.group(`Generating static content to ${config.publicDir}`);

/**
 * @param {string} source
 * @return {string}
 */
 function processTemplate(source, context) {
  const sortedPostIndex = Object.values(postIndex).sort((a, b) => b.date - a.date);
  const index = sortedPostIndex.findIndex(post => context ? (post.id == context.id) : false);
  context = {
    ...context,
    nav: index < 0 ? undefined : {
      previous: index > 0 ? sortedPostIndex[index - 1].id : undefined,
      next: index < sortedPostIndex.length - 1 ? sortedPostIndex[index + 1].id : undefined,
    },
    postIndex: sortedPostIndex,
    config
  };
  const entries = Object.entries(context);
  return new Function(...entries.map(([k, _]) => k), 'return `' + source + '`')
    (...entries.map(([_, v]) => v));
}

function copyMaybeTemplated(source, destination) {
  if(fs.statSync(source).isFile()) {
    if(config.staticTemplateExts.includes(path.extname(source))) {
      console.group(`Generating template ${source} to ${destination}`);
      const content = fs.readFileSync(source).toString();
      fs.writeFileSync(destination, processTemplate(content));
      console.groupEnd();
    } else {
      console.group(`Copying from ${source} to ${destination}`)
  
      if(fs.existsSync(destination)) {
        console.log(`Removing old ${destination}`);
        fs.rmSync(destination, { recursive: true });
      }
  
      if(path.basename(source) == config.sourceIndex) {
        console.log(`Source file (${path.basename(source)}), skipping`);
      } else {
        fs.cpSync(source, destination, { recursive: true });
      }
      console.groupEnd();
    }
  } else { // source is a directory
    console.group(`Copying directory ${source} to ${destination}`);
    if(fs.existsSync(destination) && fs.statSync(destination).isFile()) {
      console.log(`Will not overwrite ${destination} as it is a file, aborting.`);
      process.exit(1);
    }
    if(!fs.existsSync(destination)) {
      console.log(`Creating directory ${destination}`);
      fs.mkdirSync(destination);
    }
    for(const file of fs.readdirSync(source)) {
      console.group(`Copying ${file}`);
      copyMaybeTemplated(path.join(source, file), path.join(destination, file));
      console.groupEnd();
    }
    console.groupEnd();
  }
}

const blogHtmlTemplate = fs.readFileSync(config.blogTemplate).toString();

remkdirMaybeSync(config.publicDir);
mkdirMaybeSync(path.join(config.publicDir, config.blogDir));

console.group(`Generating files to ${path.join(config.publicDir, config.blogDir)}`);
for(const file of sources) {
  copyMaybeTemplated(
    path.join(config.sourcesDir, file),
    path.join(config.publicDir, file)
  );
}
console.groupEnd();

console.group(`Generating blog to ${path.join(config.publicDir, config.blogDir)}`);
for(const [id, post] of Object.entries(postIndex)) {
  mkdirMaybeSync(path.join(config.publicDir, config.blogDir, post.id));
  const indexPath = path.join(config.publicDir, config.blogDir, post.id, config.htmlIndex);
  console.group(`Writing post content (${id}) to ${indexPath}`);
  const postContent = processTemplate(post.html, post);
  fs.writeFileSync(indexPath, processTemplate(blogHtmlTemplate, { ...post, postContent }));
  
  {
    const source = path.join(config.sourcesDir, config.blogDir, config.htmlIndex)
    const destination = path.join(config.publicDir, config.blogDir, config.htmlIndex);
    copyMaybeTemplated(source, destination);
  }

  for(const file of post.files) {
    const destination = path.join(config.publicDir, config.blogDir, post.id, file);
    const source = path.join(config.sourcesDir, config.blogDir, post.id, file);
    copyMaybeTemplated(source, destination);
  }
  console.groupEnd();
}

console.groupEnd();
