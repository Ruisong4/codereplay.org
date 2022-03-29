import type { NextPage } from "next"
import dynamic from "next/dynamic"
import LoginButton from "../../components/LoginButton"
import { useSession } from "next-auth/react"
import { Button, Divider, FormControl, InputAdornment, InputLabel, MenuItem, Select, TextField } from "@mui/material"
import { useEffect, useState } from "react"

const Recorder = dynamic(() => import("../../components/Recorder"), { ssr: false })

type GroupInfo = {
  email: string;
  role: string;
  active: boolean;
  groupId: string;
  name: string;
}

type RecordingContext = {
  iframeHeight: string;
  groupId: string;
  embedId: string;
  language: string;
  fileCount: number;
  name: string;
}

const languages = ["python", "cpp", "haskell", "java", "julia", "r", "c", "go", "rust", "scala3", "kotlin"]

const UserHome: NextPage = () => {
  const { data } = useSession()
  let [newGroupName, setNewGroupName] = useState<string>("")
  let [groups, setGroups] = useState<GroupInfo[]>([])
  let [contexts, setContexts] = useState<RecordingContext[]>([])
  let [language, setLanguage] = useState<string>("python")
  let [group, setGroup] = useState("")

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/recording_group`, { credentials: "include" }).then(r => r.json()).then(response => setGroups(response.groups))
  }, [data])

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/recording_context`, { credentials: "include" }).then(r => r.json()).then(response => setContexts(response.contexts))
  }, [data])

  const createContext = async (e) => {
    e.preventDefault()
    console.log(e)
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/recording_context`, {
      method: "post",
      body: JSON.stringify({
        groupId: e.target.elements.group.value,
        iframeHeight: e.target.elements.iframeHeight.value,
        language: e.target.elements.language.value,
        fileCount: e.target.elements.fileCount.value,
        embedId: (new Date()).valueOf().toString(),
        name: e.target.elements.name.value,
      }),
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include"
    }).then(r => r.json())
    setContexts([...contexts, response.newContext])
  }

  return (
    <>
      <LoginButton />
      {
        data &&
        <div className={"user_home_container"}>
          <div>My Groups</div>
          {
            groups.map((g, i) => {
              return <div key={i}> {g.name + " " + g.groupId} </div>
            })
          }
          <Divider />
          <div className={"user_home_create_group"}>
            <TextField onChange={(e) => setNewGroupName(e.target.value)} />
            <Button onClick={async () => {
              await fetch(`${process.env.NEXT_PUBLIC_API_URL}/recording_group`, {
                method: "post",
                body: JSON.stringify({ name: newGroupName }),
                headers: {
                  "Content-Type": "application/json"
                },
                credentials: "include"
              }).then(async (r) => {
                const newGroup = await r.json()
                setGroups(prevState => [...prevState, newGroup.newGroup])
              })
            }}>Create Group</Button>
          </div>
          <div>My Recording</div>
          {
            contexts.map((c, i) => {
              return <div key={i}>
                <div>{c.name}</div>
                <div>{`<iframe src="http://localhost:3000/group/${c.groupId + "-" + c.embedId}" width="100%" height="${c.iframeHeight}px" style="border:none; overflow: hidden" scrolling="no"> </iframe>`}</div>
              </div>
            })
          }

          <div className={"user_home_create_recording_embed"}>
            <form id="new_context_form" onSubmit={event => createContext(event)}>
              <TextField
                name="iframeHeight"
                label="iframeHeight"
                InputProps={{
                  endAdornment: <InputAdornment position="end">px</InputAdornment>
                }}
              />
              <TextField
                name="fileCount"
                label="fileCount"
              />
              <TextField
                name="name"
                label="name"
              />
              <FormControl variant="standard" fullWidth sx={{minWidth: "100px"}}>
                <InputLabel>Language</InputLabel>
                <Select
                  name="language"
                  label="language"
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                >
                  {
                    languages.map((l, i) => {
                      return <MenuItem key={i} value={l}>{l}</MenuItem>
                    })
                  }
                </Select>
              </FormControl>

              <FormControl variant="standard" fullWidth sx={{minWidth: "100px"}}>
                <InputLabel>group</InputLabel>
                <Select
                  name="group"
                  label="group"
                  value={group}
                  onChange={e => setGroup(e.target.value)}
                >
                  {
                    groups.map((g, i) => {
                      if (g.role === "creator")
                        return <MenuItem key={i} value={g.groupId}>{g.name}</MenuItem>
                      return null
                    })
                  }
                </Select>
              </FormControl>

              <Button type="submit">Create iframe</Button>
            </form>
          </div>
        </div>
      }
    </>
  )
}

export default UserHome
