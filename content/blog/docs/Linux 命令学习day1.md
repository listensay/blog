---
title: Linux 命令学习day1
description: 学习 Linux 入门命令与 Vim 基础操作，掌握文件、目录和文本编辑的常用方法
date: 2026-08-24 16:51
slug: linux-commands-day1
category: Linux
tags:
  - Linux
  - 命令
  - Vim
  - 教程
---
# Linux 命令学习 Day 1

## 一、命令格式说明

Linux 命令通常由命令名、选项和参数组成：

```bash
<命令> [选项] [参数]
```

本文约定：`<内容>` 是必填占位符，需要替换成实际值；`[内容]` 是可选内容，可以省略；`...` 表示前面的内容可以重复。比如 `cp [选项] <源文件> <目标路径>` 是语法，实际执行时应替换为具体文件名：

```bash
cp -r project project-backup
```

下面代码中的 `$` 是终端提示符，不需要输入。

## 二、文件和目录命令

### 1. `pwd`：查看当前目录

语法：

```bash
pwd
```

`pwd`（print working directory）打印当前工作目录的绝对路径。

```bash
$ pwd
/home/user/project
```

绝对路径从根目录 `/` 开始，相对路径以当前目录为起点。

### 2. `ls`：查看目录内容

语法：

```bash
ls [选项] [目录]
```

| 选项 | 作用 |
| --- | --- |
| `-l` | 详细列表显示 |
| `-a` | 显示隐藏文件 |
| `-h` | 以易读格式显示大小，常与 `-l` 配合 |

示例：

```bash
ls
ls /etc
ls -l
ls -la
ls -lh <目录>
```

部分发行版将 `ll` 配置为 `ls -l` 的别名，但 `ll` 并非所有系统都自带。

### 3. `cd`：切换目录

语法：

```bash
cd [路径]
```

```bash
cd /var/log       # 绝对路径
cd project        # 当前目录下的 project
cd ..             # 上一级目录
cd .              # 当前目录
cd ~              # 用户家目录
cd -              # 上一次所在目录
```

路径包含空格时使用引号或反斜杠：`cd "my project"`、`cd my\ project`。

### 4. `mkdir`：创建目录

语法：

```bash
mkdir [选项] <目录名>...
```

`-p` 表示连同不存在的父目录一起创建。

```bash
mkdir notes
mkdir dir1 dir2
mkdir -p project/src/main
```

### 5. `touch`：创建文件

语法：

```bash
touch <文件名>...
```

文件不存在时创建空文件；文件已存在时只更新修改时间，不会清空内容。

```bash
touch note.txt
touch index.html style.css script.js
```

### 6. `cp`：复制文件或目录

语法：

```bash
cp [选项] <源文件或目录> <目标路径>
cp [选项] <源文件>... <目标目录>
```

| 选项 | 作用 |
| --- | --- |
| `-r` 或 `-R` | 递归复制目录 |
| `-i` | 覆盖前询问 |
| `-v` | 显示复制过程 |

```bash
cp source.txt backup.txt
cp source.txt notes/
cp -r project project-backup
```

### 7. `rm`：删除文件或目录

语法：

```bash
rm [选项] <文件或目录>...
```

| 选项 | 作用 |
| --- | --- |
| `-i` | 删除前确认 |
| `-r` | 递归删除目录 |
| `-f` | 强制删除，不询问 |

```bash
rm note.txt
rm -i note.txt
rm -r old-project
rm -rf old-project
```

命令行删除通常不会进入回收站。`rm -rf` 风险较高，执行前务必确认路径。

### 8. `mv`：移动或重命名

语法：

```bash
mv [选项] <源路径> <目标路径>
mv [选项] <源文件>... <目标目录>
```

```bash
mv note.txt notes/
mv old-name.txt new-name.txt
mv project /tmp/
```

目标存在同名文件时可能覆盖，必要时使用 `mv -i`。

### 9. `cat`：查看文件内容

语法：

```bash
cat [选项] [文件]...
```

`-n` 用于显示行号。

```bash
cat note.txt
cat file1.txt file2.txt
cat -n note.txt
```

### 10. `tail`：查看文件尾部

语法：

```bash
tail [选项] [文件]...
```

| 选项 | 作用 |
| --- | --- |
| `-n <行数>` | 显示最后指定行数 |
| `-f` | 持续跟踪新增内容 |

```bash
tail app.log
tail -n 20 app.log
tail -f app.log
```

执行 `tail -f` 后按 `Ctrl+C` 退出。

### 11. `echo`：输出文本和重定向

语法：

```bash
echo [选项] [字符串]...
```

```bash
echo "Hello Linux"
echo "第一行" > message.txt
echo "第二行" >> message.txt
```

`>` 覆盖写入，`>>` 追加写入；目标文件不存在时两者都会创建文件。

## 三、路径和通配符

| 符号 | 含义 |
| --- | --- |
| `/` | 根目录 |
| `~` | 当前用户的家目录 |
| `.` | 当前目录 |
| `..` | 上一级目录 |
| `*` | 匹配任意多个字符 |
| `?` | 匹配任意一个字符 |

```bash
ls *.txt
cp *.jpg images/
rm temp?.log
```

## 四、命令帮助

```bash
<命令> --help
man <命令>
```

例如：`cp --help`、`man mkdir`。

## 五、Vim 基础

Vim 是常见的终端文本编辑器。它通过不同模式区分“输入文字”和“执行编辑命令”。

### 1. 打开文件

语法：

```bash
vim [选项] [文件名]
```

```bash
vim note.txt
```

文件不存在时，保存后会创建该文件。

### 2. 主要模式

| 模式 | 作用 | 进入方式 |
| --- | --- | --- |
| 普通模式 | 移动、复制、删除、执行命令 | Vim 启动默认模式；按 `Esc` 返回 |
| 插入模式 | 输入和编辑文本 | 普通模式按 `i`、`a`、`o` 等 |
| 命令行模式 | 保存、退出、查找替换 | 普通模式按 `:` |
| 可视模式 | 选择文本 | 普通模式按 `v`、`V` 或 `Ctrl+V` |

### 3. 插入文本

| 按键 | 作用 |
| --- | --- |
| `i` | 在光标前插入 |
| `a` | 在光标后插入 |
| `I` | 在行首插入 |
| `A` | 在行尾插入 |
| `o` | 在当前行下方新建一行并插入 |
| `O` | 在当前行上方新建一行并插入 |

输入完成后按 `Esc` 回到普通模式。

### 4. 移动光标

以下按键在普通模式下使用：

| 按键 | 作用 |
| --- | --- |
| `h`、`j`、`k`、`l` | 左、下、上、右移动 |
| `0`、`$` | 移到行首、行尾 |
| `gg`、`G` | 移到文件开头、末尾 |
| `:<行号>` | 跳转到指定行 |

### 5. 删除、复制、粘贴和撤销

| 按键 | 作用 |
| --- | --- |
| `x` | 删除光标所在字符 |
| `dd` | 删除当前行 |
| `ndd` | 删除当前行起的 `n` 行 |
| `yy` | 复制当前行 |
| `nyy` | 复制当前行起的 `n` 行 |
| `p` | 粘贴到光标之后或下一行 |
| `u` | 撤销 |
| `Ctrl+R` | 重做 |

这里的 `n` 是数字占位符，例如 `3dd` 表示删除 3 行。

### 6. 保存和退出

普通模式下按 `:`，输入命令后按回车：

| 命令 | 作用 |
| --- | --- |
| `:w` | 保存 |
| `:q` | 退出 |
| `:wq` | 保存并退出 |
| `:q!` | 不保存，强制退出 |
| `:w <文件名>` | 另存为指定文件 |

常用流程：按 `i` 输入内容，按 `Esc` 返回普通模式，输入 `:wq` 保存并退出。

### 7. 查找和替换

| 按键或命令 | 作用 |
| --- | --- |
| `/关键词` | 向下查找 |
| `?关键词` | 向上查找 |
| `n`、`N` | 下一个、上一个匹配项 |
| `:%s/<旧内容>/<新内容>/g` | 替换全文内容 |

例如：

```vim
:%s/Linux/linux/g
```

表示将全文中的 `Linux` 替换为 `linux`。

## 六、练习题

建议先创建专门的 `linux-day1` 目录，所有练习都在该目录内完成。

### 练习 1：创建目录结构

创建以下目录和文件，并用 `pwd`、`ls -la` 检查：

```text
linux-day1/
├── docs/
│   └── note.txt
└── backup/
```

#### 答案

```
 mkdir -p linux-day1/docs linux-day1/backup
 touch linux-day1/docs/note.txt
 pwd
 ls -la
```

### 练习 2：移动、重命名和复制

创建 `old.txt`，将它移动到 `docs` 并重命名为 `new.txt`；再将 `docs` 复制为 `docs-backup`。

#### 答案

```
touch docs/old.txt
mv docs/old.txt docs/new.txt
cp -r docs/ docs-backup/
```

### 练习 3：练习重定向

用 `echo` 创建 `log.txt` 并写入第一行，再用 `>>` 追加第二行，最后用 `cat -n log.txt` 查看结果，并说明 `>` 与 `>>` 的区别。

#### 答案

```
// 创建文件
// '>' 代表覆盖写入，如果没有文件会自动创建文件。
echo "Hello Linux" > log.txt
// 追加到第二行
// '>>' 代表追加写入，在文件底部追加一行内容，如果文件不存在会自动创建文件。
echo "one line test" >> log.txt
// 读取所有内容
cat -n log.txt
```

### 练习 4：练习通配符和 `tail`

创建 `a.txt`、`b.txt`、`c.md`、`app.log`，用一条 `ls` 命令只查看 `.txt` 文件，再用 `tail -n 5` 查看 `app.log` 的最后 5 行。

#### 答案

```
// 批量创建文件
touch a.txt b.txt c.md app.log
echo "1" >> app.log 
echo "1" >> app.log 
echo "1" >> app.log 
echo "1" >> app.log 
echo "1" >> app.log 
echo "1" >> app.log 
echo "1" >> app.log 
echo "1" >> app.log 
echo "1" >> app.log 
echo "1" >> app.log 
echo "1" >> b.txt
echo "1" >> b.txt
echo "1" >> b.txt
echo "1" >> b.txt
echo "1" >> b.txt
echo "1" >> b.txt
echo "1" >> b.txt
echo "1" >> b.txt
// 输入
ls *.txt
// 结果
a.txt  b.txt  log.txt
// 输入
tail -n 5 app.log 
// 结果
1
1
1
1
1
```

### 练习 5：Vim 创建和编辑文件

用 Vim 创建 `vim-note.txt`，输入至少 5 行笔记；用 `dd` 删除一行，用 `yy` 和 `p` 复制粘贴一行；最后用 `:wq` 保存退出，并用 `cat -n vim-note.txt` 检查。

#### 答案

```
// 1.创建文件
vim vim-note.txt
// 按下i进入插入模式
1
2
3
4
5
// 光标移到5按下dd 结果：
1
2
3
4
// 光标在4 按下yy复制，然后按下p粘贴 结果：
1
2
3
4
4
// :wq 退出 cat检查效果
cat vim-note.txt 
1
2
3
4
4
```

### 练习 6：Vim 查找和替换

在 `vim-note.txt` 中写入多处 `Linux`，使用 `/Linux` 查找，再用 `:%s/Linux/linux/g` 全文替换为小写，最后保存退出。

#### 答案

```
vim vim-note.txt
// 按下i 输入多个Linux
1
2
3
4
4
Linux
Linux
Linux
Linux
// 按下: 然后输入%s/Linux/linux/g
1
2
3
4
4
linux
linux
linux
linux
// 然后按下:wq 保存退出
```

### 练习 7：综合练习

创建 `logs` 目录和至少 12 行的 `access.log`：用 `tail -n 5` 查看末尾，将文件复制到 `backup`，把原文件重命名为 `access-old.log`，再用 Vim 在末尾添加一行说明并保存。

#### 答案

```
touch logs
echo 'access.log' >> logs
echo 'access.log' >> logs
echo 'access.log' >> logs
echo 'access.log' >> logs
echo 'access.log' >> logs
echo 'access.log' >> logs
echo 'access.log' >> logs
echo 'access.log' >> logs
echo 'access.log' >> logs
echo 'access.log' >> logs
echo 'access.log' >> logs
echo 'access.log' >> logs
tail -n 5 logs
// 输出
access.log
access.log
access.log
access.log
access.log
// 输入
cp logs backup/access-old.log
vim backup/access-old.log
// 输入i 光标移动到结尾回车新增一行，输入'done'。完成后按下'esc' 输入:wq保存
cat backup/access-old.log 
access.log
access.log
access.log
access.log
access.log
access.log
access.log
access.log
access.log
access.log
access.log
access.log
done
```

## 七、小结

```text
pwd     查看当前位置       ls      查看目录内容
cd      切换目录           mkdir   创建目录
touch   创建文件           cp      复制
rm      删除               mv      移动或重命名
cat     查看全文           tail    查看尾部内容
echo    输出或写入文本     vim     编辑文本文件
```

后续可以继续学习管道 `|`、文本搜索 `grep`、文件查找 `find` 以及权限管理命令。
