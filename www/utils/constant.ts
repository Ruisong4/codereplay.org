import { Language } from "@codereplay/types"

/**
 * @TODO get warning when the key is only Language and use a variable as index.
 * */
export const DEFAULT_FILES = {
  python: "main.py",
  cpp: "main.cpp",
  haskell: "main.hs",
  java: "Main.java",
  julia: "main.jl",
  r: "main.R",
  c: "main.c",
  go: "main.go",
  rust: "main.rs",
  kotlin: "Main.kt",
  scala3: "Main.sc"
} as Record<Language|string, string>

export const FILE_ENDINGS: {[key in Language | string]: string} = {
  python: "py",
  cpp: "cpp",
  haskell: "hs",
  java: "java",
  julia: "jl",
  r: "R",
  c: "c",
  go: "go",
  rust: "rs",
  kotlin: "kt",
  scala3: "sc"
}

export const USE_MARKDOWN_FLAG = "<!--USE_MARK_DOWN-->"

export const PLAYGROUND_ENDPOINT = `${process.env.NEXT_PUBLIC_API_URL}/playground`
export const ILLINOIS_API_URL = `${process.env.NEXT_PUBLIC_ILLINOIS_API_URL}/playground`