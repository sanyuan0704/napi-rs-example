# 如何用 napi-rs 打造 Rust 前端工具链

随着 SWC、Rspack 等 Rust 前端工具链的出现，Rust 逐渐成为了前端基建的重要一环。作为一门系统级别的语言，Rust 可以编译出高性能的二进制文件，并且相比于 Node.js 可以做到高度地并发，从而让前端工具链的性能达到了一个新的高度。而在这背后，你有没有想过，Rust 是如何和 JavaScript 进行交互的呢？

答案就是 [napi-rs](https://napi.rs)。这个库可以说是 Rust 前端工具链的基石，搭建了 Node.js 和 Rust 之间语言通信的桥梁。在这篇文章中，我们将会使用 napi-rs 来编写一个 Rust 的前端工具，来感受一下 Rust 和 Node.js 中间的交互，并且将这个工具最终发布到 npm 上。

## 前置环境

在开始之前，我们需要先安装好 Rust 的开发环境。Rust 的安装可以参考 [Rust 官网](https://www.rust-lang.org/tools/install)，安装完成之后，我们可以通过以下命令来检查环境是否安装成功：

```bash
$ rustc --version
```

> 在安装完成之后，Rust 会自动安装 Cargo，这是 Rust 的包管理工具，类似于 Node.js 中的 npm。

## 创建项目

在安装好 Rust 环境之后，我们就可以开始创建项目了。我们可以使用 `napi-rs` 官方脚手架，首先通过以下命令安装脚手架：

```bash
yarn global add @napi-rs/cli
# 或者
npm install -g @napi-rs/cli
# 或者
pnpm add -g @napi-rs/cli
```

然后通过以下命令创建项目：

```bash
napi new
```

先输入项目的名字，建议加上 scope（比如 `@islandjs/napi-rs-example`），这是因为我们最终会将不同平台的二进制产物发布到 npm 上，而一旦这些包不在同一个 scope，就可能会触发 npm 的 `spam detection`(垃圾包检测)，导致发布失败。

> 你需要在 npm 上创建一个 scope，比如 `@islandjs`，然后将这个 scope 添加到你的 npm 账号上，具体可以参考 [npm 官方文档](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages#publishing-scoped-public-packages-to-the-public-npm-registry)。

```bash
  napi new
? Package name: (The name filed in your package.json)
```

然后选择目录名:

```bash
napi new
? Package name: (The name filed in your package.json) @napi-rs/cool
? Dir name: (cool)
```

下一步是选择你想支持哪个平台。如果想要支持所有平台，可以按 A 全选，然后按 enter：

```bash
napi new
? Package name: (The name filed in your package.json) @napi-rs/cool
? Dir name: cool
? Choose targets you want to support aarch64-apple-darwin, aarch64-linux-android, aarch64-unknown-linux-gnu
, aarch64-unknown-linux-musl, aarch64-pc-windows-msvc, armv7-unknown-linux-gnueabihf, x86_64-apple-darwin,
x86_64-pc-windows-msvc, x86_64-unknown-linux-gnu, x86_64-unknown-linux-musl, x86_64-unknown-freebsd, i686-p
c-windows-msvc, armv7-linux-androideabi
? Enable github actions? (Y/n)
```

下一步是`是否启用 Github Actions`，由于我们后续需要将其发布到 npm 上，所以这里选择 Y。

接下来 napi-rs 会自动帮助我们安装好项目的依赖，这样我们就完成了项目的初始化。

## 目录结构说明

在项目初始化完成之后，我们可以看到项目的目录结构如下：

```bash
.
├── Cargo.lock
├── Cargo.toml
├── README.md
├── __test__
│   └── index.spec.mjs
├── build.rs
├── index.d.ts
├── index.js
├── npm
│   ├── darwin-arm64
│   │   ├── README.md
│   │   └── package.json
│   ├── darwin-x64
│   │   ├── README.md
│   │   └── package.json
│   ├── linux-x64-gnu
│   │   ├── README.md
│   │   └── package.json
│   └── win32-x64-msvc
│       ├── README.md
│       └── package.json
├── package.json
├── rustfmt.toml
├── src
│   └── lib.rs
├── tutorial.md
└── yarn.lock
```

你需要关心的目录和文件主要有下面几个:

- `src`: 这个目录下是 Rust 代码，我们的核心逻辑都会在这里实现。
- `index.js`: 这个文件是我们的入口文件，也就是说，外部调用我们的包的时候，实际上是调用了这个文件。
- `build.rs`: napi-rs 会在编译的时候自动调用这个脚本文件，用来生成一些编译时需要的代码。
- `npm`: 这个目录下存放我们的二进制文件，napi-rs 会在 GitHub Actions 上自动帮我们编译出不同平台的二进制文件，并且将其放在这个目录下。这些平台在初始化项目的时候我们已经选择好了。

当然，还有 `.github` 目录，这个目录下存放的是 GitHub Actions 的配置文件，我们可以在这里配置一些自动化的流程，比如自动编译二进制文件、自动发布到 npm 等等，这部分的流程配置代码 napi-rs 脚手架已经帮我们写好了，无需修改。

## 内部调用机制

在完成项目的初始化之后，我们通过以下命令来编译项目：

```bash
yarn build
```

这个命令会自动调用 `build.rs` 脚本，生成一些编译时需要的代码，然后再调用 `cargo build` 来编译 Rust 代码，最终会将编译产物(.node 结尾的文件)放在项目根目录下。我使用的是 M1 Mac，所以编译出来的文件是 `napi-rs-example.darwin-arm64.node`。

接下来我们来分析一下 `index.js` 文件，这个文件是我们的入口文件，也就是说，外部调用我们的包的时候，实际上是调用了这个文件。简化后的逻辑如下:

```js
switch (platform) {
  case "android":
    // ...
    break;
  case "win32":
    // ...
    break;
  case "darwin":
    switch (arch) {
      case "x64":
        // 本地直接使用根目录下 `napi-rs-example.linux-arm64-gnu.node`
        // 发布时，这个 .node 文件会被 `@islandjs/napi-rs-example-darwin-arm64` 这个包发布到 npm 上
        localFileExisted = existsSync(
          join(__dirname, "napi-rs-example.darwin-arm64.node")
        );
        try {
          if (localFileExisted) {
            nativeBinding = require("./napi-rs-example.darwin-arm64.node");
          } else {
            nativeBinding = require("@islandjs/napi-rs-example-darwin-arm64");
          }
        } catch (e) {
          loadError = e;
        }
        break;
    }
    break;
  case "freebsd":
    // ...
    break;
  case "linux":
    switch (arch) {
      case "x64":
        // ...
        break;
      case "arm64":
      // ...
      case "arm":
        // ...
        break;
      default:
        throw new Error(`Unsupported architecture on Linux: ${arch}`);
    }
    break;
  default:
    throw new Error(`Unsupported OS: ${platform}, architecture: ${arch}`);
}

const { sum } = nativeBinding;

module.exports.sum = sum;
```

这个入口会根据操作系统和 CPU 架构来加载不同的二进制文件，值得注意的是，本地开发阶段和发布到 npm 后的调用策略是不一样的：

- 本地开发阶段，当你执行 `yarn build` 时，会直接使用根目录下的二进制文件，也就是 `napi-rs-example.darwin-arm64.node`，这个文件是通过 `cargo build` 生成的。
- 发布到 npm 后，当用户执行 `yarn add @islandjs/napi-rs-example` 时，会自动下载 `@islandjs/napi-rs-example-darwin-arm64` 这个包，这个包里面包含了编译好的二进制文件，也就是 `napi-rs-example.darwin-arm64.node`。这时候入口文件会去加载这个包里面的二进制文件。

你可能会问了，在本地 `yarn build` 之后，并没有发现 `npm` 目录下有 `.node` 产物呀，这样发布出去岂不是没有产物了？

不用担心，在 GitHub 脚本中，napi-rs 会自动执行编译和产物移动的操作，将所有的 `.node` 文件移动到 `npm` 目录下对应平台的子目录中，从而最终能够保证发布到 npm 后，用户能够正常使用。GitHub CI 总体流程如下:

![](https://files.mdnice.com/user/6411/bd8a983e-1c79-4689-b671-f9495073ce93.png)

最后，`index.js` 的调用逻辑可以简化为下面这张图:

![](https://files.mdnice.com/user/6411/e7b60fb0-7ccf-4b49-bd8f-c40e9e544aa4.png)

## 编写 Rust 侧代码

接下来我们把目光转移到 Rust 侧，我们的核心逻辑都会在这里实现。在 `src/lib.rs` 中，我们可以看到这样一段代码:

```rust
#[napi]
pub fn sum(a: i32, b: i32) -> i32 {
  a + b
}
```

通过 `#[napi]` 宏，我们可以将 Rust 函数暴露给 JavaScript 使用。这个宏会自动帮我们生成一些代码，使得我们的 Rust 函数能够被 JavaScript 调用。

在执行 `yarn build` 之后，我们会发现根目录增加了`index.d.ts`，也就是说，napi-rs 已经帮我们生成了类型声明文件，类型文件的内容如下：

```ts
export function sum(a: number, b: number): number;
```

可以看到，Rust 中的 i32 类型被转换成了 JavaScript 中的 number 类型。而对于其它的诸多数据类型，napi-rs 也都做了相应的转换，具体可以参考[官方文档](https://napi.rs/docs/concepts/function)。

下面我们以几个典型的例子来实操一下。

### 1. 传递字符串

在 `lib.rs` 中添加如下的代码：

```rust
#[napi]
pub fn concat_str(a: String, b: String) -> String {
  format!("{}{}", a, b)
}
```

执行 `yarn build`，我们发现 `index.js` 多出了 `concatStr` 方法，这个方法就是我们刚刚在 Rust 中定义的方法，只不过在 JavaScript 中，方法名被自动转换成了驼峰式命名。并且你也能发现类型声明文件也被更新了，内容如下：

```ts
export function sum(a: number, b: number): number;
export function concatStr(a: string, b: string): string;
```

然后我们在 `__test__/index.spec.mjs` 中增加对应的测试代码:

```js
import test from "ava";

import { sum, concatStr } from "../index.js";

test("sum from native", (t) => {
  t.is(sum(1, 2), 3);
});

// 增加测试
test("concatStr from native", (t) => {
  t.is(concatStr("Hello", "World"), "HelloWorld");
});
```

执行 `yarn test`，测试通过。

### 2. 传递对象

在 `lib.rs` 中添加如下的代码：

```rust
#[napi]
pub fn get_options(options: ToolOptions) -> ToolOptions {
  println!("id: {}, name: {}", options.id, options.name);
  options
}
```

执行 `yarn build`，我们发现 `index.js` 多出了 `getOptions` 方法，我们还是在 `__test__/index.spec.mjs` 中增加对应的测试代码:

```ts
import { getOptions } from "../index.js";

test("getOptions from native", (t) => {
  const options = {
    id: 1,
    name: "napi-rs",
  };
  t.deepEqual(getOptions(options)).toEqual(options);
});
```

### 3. 导出为异步函数

默认情况下，napi-rs 会将 Rust 函数导出为同步函数，如果我们想要导出异步函数给 Node.js 侧使用，可以通过下面的方式来实现。

我们在 `lib.rs` 中添加如下的代码:

```rust
use napi::{Task, Env, Result, JsNumber};

struct AsyncFib {
  input: u32,
}

impl Task for AsyncFib {
  type Output = u32;
  type JsValue = JsNumber;

  fn compute(&mut self) -> Result<Self::Output> {
    Ok(fib(self.input))
  }

  fn resolve(&mut self, env: Env, output: u32) -> Result<Self::JsValue> {
    env.create_uint32(output)
  }
}

pub fn fib(n: u32) -> u32 {
  match n {
    0 | 1 => n,
    _ => fib(n - 1) + fib(n - 2),
  }
}

// 指定 JS 侧的返回值类型为 Promise<number>
#[napi(ts_return_type="Promise<string>")]
fn async_fib(input: u32) -> AsyncTask<AsyncFib> {
  AsyncTask::new(AsyncFib { input })
}
```

要返回一个异步的函数，我们需要实现 `Task` trait，这个 trait 有两个关联类型，`Output` 和 `JsValue`，分别表示 Rust 函数的返回值类型和 JavaScript 中对应的类型。在 `compute` 方法中，我们实现了具体的计算逻辑，而在 `resolve` 方法中，我们将计算结果转换成了 JavaScript 中的 `JsNumber` 类型。然后我们在 `async_fib` 函数中，通过 `AsyncTask::new` 来创建一个异步任务，这个函数的返回值类型是 `AsyncTask<AsyncFib>`，这个类型会被 napi-rs 自动转换成 JavaScript 中的 `Promise` 类型。

最后导出对应的类型声明如下:

```ts
export function asyncFib(input: number): Promise<number>;
```

我们在 `__test__/index.spec.mjs` 中增加对应的测试代码:

```ts
import { asyncFib } from "../index.js";

test("asyncFib from native", async (t) => {
  t.is(await asyncFib(10), 55);
});
```

### 4. 把 JS 函数放到 Rust 中执行

还有一种比较常见的场景，就是我们需要把 JavaScript 中的函数传递到 Rust 中执行，这个时候我们可以使用 napi-rs 中的 `ThreadSafeFunction` 来实现。

我们在 `lib.rs` 中添加如下的代码:

```rust
use std::thread;

use napi::{
  bindgen_prelude::*,
  threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode},
};

// 强制指定参数类型
#[napi(ts_args_type = "callback: (err: null | Error, result: number) => void")]
pub fn call_threadsafe_function(callback: JsFunction) -> Result<()> {
  let tsfn: ThreadsafeFunction<u32, ErrorStrategy::CalleeHandled> = callback
    // ctx.value 即 Rust 调用 JS 函数时传递的入参，封装成 Vec 传递给 JS 函数
    .create_threadsafe_function(0, |ctx| ctx.env.create_uint32(ctx.value).map(|v| vec![v]))?;
  for n in 0..100 {
    let tsfn = tsfn.clone();
    thread::spawn(move || {
      // 通过 tsfn.call 来调用 JS 函数
      tsfn.call(Ok(n), ThreadsafeFunctionCallMode::Blocking);
    });
  }
  Ok(())
}
```

接着我们执行 `yarn build`，我们发现 `index.js` 多出了 `callThreadsafeFunction` 方法，我们还是在 `__test__/index.spec.mjs` 中增加对应的测试代码:

```ts
import { callThreadsafeFunction } from "../index.js";

test("callThreadsafeFunction from native", async (t) => {
  t.is(
    callThreadsafeFunction((err, ...args) => {
      console.log("Get the result from rust", args);
    })
  );
});
```

执行 `yarn test`，我们可以发现控制台成功输出:

```bash
Get the result from rust [ 0 ]
Get the result from rust [ 1 ]
Get the result from rust [ 2 ]
...
Get the result from rust [ 99 ]
```

这样我们就成功地把 JavaScript 中的函数传递到 Rust 中执行了，大大丰富了 Rust 和 Node.js 交互的能力。

## 工程化

以上我们介绍了 napi-rs 的基本使用，但是在实际的开发场景中，我们如何要搭建一个真实可用的 Rust 前端工具，应该怎么做呢？

### 1. crate 组织

我们可以把整个工具拆分成多个 crate，每个 crate 有各自的职责，这样可以提高代码的复用性，同时也方便我们进行单元测试。

而 Rust 中的包管理是天生的 Monorepo 结构，我们可以把所有的 crate 都放到一个仓库中，然后通过 `Cargo.toml` 中的 `workspace` 字段来管理:

```toml
[workspace]
members = ["crates/*"]
```

然后将所有的 crate 放到 `crates` 目录下，这样我们就可以通过 `cargo build/test` 来同时构建/测试所有的 crate 了。

在实际的工程项目中，我们一般会新建一个 `binding` crate，用来做 napi-rs 的导出，核心的逻辑放到其它的 crate 中完成，细节可以参考我曾经搭建的 Rust 版 MDX 编译工具，仓库地址: https://github.com/web-infra-dev/mdx-rs-binding.

### 2. 测试

在实际的开发中，我们需要编写单元测试来保证代码的正确性。而 Rust 中的单元测试工具是天生自带的，我们只需要在对应的文件中编写测试代码即可，然后通过 `cargo test` 来执行测试，成本非常低。比如：

```rust
// src/lib.rs
fn fib(n: u32) -> u32 {
  match n {
    0 | 1 => n,
    _ => fib(n - 1) + fib(n - 2),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_fib() {
    assert_eq!(fib(10), 55);
  }
}
```

### 3. GitHub Actions CI

由于 napi-rs 已经帮助我们初始化了 CI 脚本，当你往 main 分支提交代码时，会自动触发 GitHub Actions 的操作，执行构建、测试、发布等步骤。

值得注意的是，在默认的脚本中，会根据当前的 commit 信息来判断是否需要发布，具体的判断逻辑如下:

- case 1: 如果当前的 commit 信息只有 `x.x.x`(x 为数字)，则发布正式版本到 npm 上
- case 2: 如果当前的 commit 信息在 case 1 的基础上增加了一些后缀内容，则发布 beta 版本到 npm 上
- 其它情况不会发布。

当然，你也可以通过修改`.github/workflows/CI.yml`来自定义发布的逻辑。

下面是发布成功的截图:

![](https://files.mdnice.com/user/6411/e76f8911-8160-4cb2-a623-3dc16ba2434e.png)

## 总结

本文主要介绍了如何使用 napi-rs 来开发 Rust 前端工具，也分享我的一些实战经验，希望能够帮助到大家。最后，给大家推荐一些值得关注的 Rust 前端工具，供大家参考:

- [mdx-rs-binding](https://github.com/web-infra-dev/mdx-rs-binding): Rust 版 MDX 编译工具
- [swc-plugins](https://github.com/web-infra-dev/swc-plugins): swc 的插件集合
- [Rspack](https://github.com/web-infra-dev/rspack): 基于 Rust 的 Web Bundler
- [svgr-rs](https://github.com/svg-rust/svgr-rs): 基于 Rust 的 SVG 转 React 组件工具
