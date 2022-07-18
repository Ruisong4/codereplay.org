import Ace, { IAceEditorProps } from "react-ace"
import React from "react"

const DefaultAceEditor: React.FC<IAceEditorProps> = (props) => {
  return (
    <Ace
      theme="github"
      width="100%"
      minLines={4}
      maxLines={4}
      showPrintMargin={false}
      onBeforeLoad={(ace) => {
        ace.config.set("basePath", `https://cdn.jsdelivr.net/npm/ace-builds@${ace.version}/src-min-noconflict`)
      }}
      {...props}
    />
  )
}
export default DefaultAceEditor
