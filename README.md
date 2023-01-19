# `ahh`

> Ahh, you need a blog!

This is Annie's Hypertext Hyperlinker! It generates simple static websites
with an optional blog :)

It's pretty small, the code itself is about 300 loc and the only dependencies are [marked.js](https://marked.js.org/), a markdown parser, and [front-matter](https://www.npmjs.com/package/front-matter), a front matter parser (for markdown metadata).

## Config file (`ahh.json`)

```js
{
  "sources": "./sources/", // directory where the website sources are.
  "public": "./public/", // directory where the generated website will go in.
  "blog": "blog/", // name of directory in `sources` that contains the blog data.
  "template": { // template information (js template strings)
    "static": [".html", ".css"], // files with these extensions are processed as templates.
    "blog": "blog/blog.html" // blog post template file.
  },
  "index": { // index file configuration.
    "source": "index.md", // blog post index file.
    "html": "index.html" // html index file. (blog post index files get converted into html index files)
  }
}
```

## Blog post markdown

Github flavoured markdown, with the default marked.js config. Required front matter:

```markdown
---
title: <post title> # not sanitized
description: <post description> # not sanitized
date: <creation date formatted as json> # example: 2023-01-18T20:11:42.035Z
author: <post author> # not sanitized
---

Your markdown goes here...
```

## Folder structure based on config

```js
- "ahh.json" // config file (see below).
- config.sources
  - * ... {localFiles} // any files.
  - config.blog // directory with the blog
    - config.index.html? // index file for this directory.
    - config.template.blog? // template for a blog post.
    - id ... {posts} // each directory represents a single blog post.
      - config.index.source? {posts[id].source} // source markdown file.
      - * ... {posts[id].localFiles} // any local files for the blog.
- config.public // this is generated
  - {localFiles}... // the local files (template processed if needed).
  - config.blog // directory with the blog
    - config.index.html? // index file for this directory.
    - {posts}... // each directory represents a single blog post.
      - config.index.html? // config.template.blog with posts[id].source
      - {posts[id].localFiles}... // the local files (template processed if needed).
```

### Example:

```lua
- ahh.json
- config.sources
  - index.html
  - style.css
  - blog
    - index.html
    - blog.html
    - post1
      - index.md
      - tomato.png
    - post2
      - index.md
      - data.json
    - post3 -- skipped, no index file
      - music.wav
- public
  - index.html -- processed as template
  - style.css
  - blog
    - index.html -- processed as template
    - post1
      - index.html -- processed template
      - tomato.png
    - post2
      - index.html -- processed template
      - data.json
```

## Templates

Some files are templates. This means that they are treated as if they were
[javascript template strings](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals).

### Predefined variables

```typescript
({
  postIndex: { // array of all posts, from latest to oldest
    author: string, // author (from front matter)
    date: Date, // date (from front matter)
    title: string, // title (from front matter)
    description: string, // post description (from front matter)
    id: string, // post id
    html: string, // generated html
    files: string[] // local files
  }[],
  config: { // used internally, provided for completeness
    sourcesDir: string, // from ahh.json: .sources
    publicDir: string, // from ahh.json: .public
    blogDir: string, // from ahh.json: .blog
    sourceIndex: string, // from ahh.json: .index.source
    htmlIndex: string, // from ahh.json: .index.html
    blogTemplate: string, // from ahh.json: .template.blog (converted to full path)
    staticTemplateExts: string[], // from ahh.json: .template.static
  },
  // TODO:
  configJson: { ... } // directly from ahh.json
})
```

### Additional variables for the post template

```js
({
  nav: {
    previous: string?, // id of previous post if one exists
    next: string?, // id of next post if one exists
  },
  author: string, // author (from front matter)
  date: Date, // date (from front matter)
  title: string, // title (from front matter)
  description: string, // post description (from front matter)
  id: string, // post id
  html: string, // generated html
  files: string[], // local files
  postContent: string // generated html post content
})
```

### Example HTML

#### sources/index.html - `.sources/.index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <meta charset="UTF-8">
  <title>Hi!</title>
  <h1>Hello!</h1>
  <p>Welcome</p>
  <nav>
    <a href="/blog">Blog</a>
    <a href="https://example.org/">Example</a>
  </nav>
</html>
```

#### sources/blog/index.html - `.sources/.blog/.index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <meta charset="UTF-8">
  <title>Blog</title>
  <h1>Blog</h1>
  <p>Blog posts:</p>
  <nav><a href="/">Home</a></nav>
  <ul>
    ${postIndex.map(post => `
      <li><a href="/blog/${post.id}">${post.title}</a></li>
    `).join('\n')}
  </ul>
</html>
```

#### sources/blog/blog.html - `.sources/.blog/.template.blog`

```html
<!DOCTYPE html>
<html lang="en">
  <meta charset="UTF-8">
  <title>${title} - Blog</title>
  <h1>${title}</h1>
  <p>${description} - by ${author} - created at ${date}</p>
  <nav><a href="/">Home</a></nav>
  <main>
    ${postContent}
  </main>
</html>
```
