import type { NextPage } from "next"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { Array } from "runtypes"
import { TraceSummary } from "@codereplay/types"
import LoginButton from "../components/LoginButton"

const colors = new Map()

function generateTagColor(normalized: string) {
  if (colors.has(normalized)) {
    return colors.get(normalized)
  }
  while (true) {
    let newColor = getRandomColor()
    if (!colors.has(newColor)) {
      colors.set(normalized, newColor)
      return newColor
    }
  }
}

function getRandomColor() {
  let letters = 'BCDEF'.split('');
  let color = '#';
  for (let i = 0; i < 6; i++ ) {
    color += letters[Math.floor(Math.random() * letters.length)];
  }
  return color;
}

const Home: NextPage = () => {
  const { data } = useSession()

  const [traces, setTraces] = useState<TraceSummary[]>([])
  const [filteredTraces, setFilteredTraces] = useState<TraceSummary[]>([])
  const [keyword, setKeyword] = useState<string>("")

  useEffect(() => {
    setFilteredTraces(traces.filter(trace => (trace.title + trace.tag + trace.description + trace.name).toLowerCase().trim().includes(keyword.toLowerCase().trim())))
  }, [keyword, traces])
  
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/traces`, { credentials: "include" })
      .then((r) => r.json())
      .then((response) => {
        response.traces.sort((a: { fileRoot: number }, b: { fileRoot: number }) => b.fileRoot - a.fileRoot)
        setTraces(Array(TraceSummary).check(response.traces))
      })
  }, [data])
  return (
    <>
      <LoginButton/>
      <div className={"home_container"}>
        <div className={"home_header"}>
          <div className={"home_title"}>List of Recordings</div>
          <input value={keyword} className={"home_search"} type={"text"} onChange={e => setKeyword(e.target.value)}/>
        </div>
        <hr/>
        {
          filteredTraces.map((trace, key) => {
            let creationTime = (new Date(trace.timestamp)).toLocaleString()
            return (
              <div key={key} className={"home_item_container"}>
                <div className={"home_item_picture_container"}>
                  <img className={"home_item_picture"} src={trace.picture}/>
                </div>
                <div className={"home_item_info_container"}>
                  <div className={"home_item_title home_item_info_row"}><a href={"/replay/" + trace.fileRoot}>{trace.title}</a></div>
                  {trace.tag.trim() !== "" && <div className={"home_item_info_row"}>{
                    trace.tag.split(",").map((t: string, k: number) => {
                      let normalized = t.toLowerCase().trim()
                      return <div style={{backgroundColor: generateTagColor(normalized)}} className={"home_item_tag"} key={key + "-" + k}>{normalized}</div>
                    })
                  }</div>}
                  <div className={"home_item_author home_item_info_row"}>Created by {trace.name} at {creationTime}</div>
                  <div className={"home_item_description home_item_info_row"}>{trace.description}</div>
                </div>
              </div>
            )
          })
        }
      </div>
    </>
  )
}

export default Home
