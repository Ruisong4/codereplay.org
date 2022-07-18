import type { NextPage } from "next"
import TopBanner from "../../components/TopBanner"
import { useSession } from "next-auth/react"
import { Box, Button, Divider, Grid, Switch, TextField, Typography } from "@mui/material"
import React, { useEffect, useState } from "react"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import Paper from "@mui/material/Paper"
import { createRecordingGroup, getRecordingGroups, updateGroupStatus } from "../../api/api"
import { RecordingGroup } from "@codereplay/types"

const UserHome: NextPage = () => {
  const { data } = useSession()
  let [newGroupName, setNewGroupName] = useState<string>("")
  let [groups, setGroups] = useState<RecordingGroup[]>([])

  useEffect(() => {
    getRecordingGroups().then(currentGroups => setGroups(currentGroups))
  }, [data])

  return (
    <>
      <TopBanner />
      {
        data &&
        <Grid container>
          <Grid item xs={1} sm={1} md={2} lg={2} xl={2}></Grid>
          <Grid item xs={10} sm={10} md={8} lg={8} xl={8} sx={{ m: "100px auto"}}>
            <Typography sx={{ m: "10px auto 30px auto" }} variant={"h4"}>My Groups</Typography>

            <Divider />
            <TableContainer component={Paper}>
              <Table sx={{ minWidth: 650 }} aria-label="simple table">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell align="left">role</TableCell>
                    <TableCell align="left">group id</TableCell>
                    <TableCell align="left">active</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groups.map((g, i) => (
                    <TableRow
                      key={i}
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        {g.name}
                      </TableCell>
                      <TableCell align="left">{g.role}</TableCell>
                      <TableCell align="left">{g.groupId}</TableCell>
                      <TableCell align="left">
                        {g.role === "creator" ?  <Switch checked={g.active} onChange={(_, checked: boolean) => {
                          const modifiedGroups = groups.map(curr => {
                            if (curr.groupId === g.groupId) {
                              curr.active = checked
                            }
                            return curr
                          })
                          setGroups(modifiedGroups)
                          updateGroupStatus(g.groupId, checked)
                        }}/> : <Typography sx={{ml: "9px"}}>{(g.active ? "yes" : "no")}</Typography>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>


            <Divider />
            <Box sx={{ pt: "15px", m: "10px auto" }}>
              <TextField label="group name"
                         onChange={(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setNewGroupName(e.target.value)} />
              <Button sx={{ display: "block", mt: "15px" }} variant="contained" color={"success"} onClick={async () => {
                createRecordingGroup(newGroupName).then(newGroup => setGroups(prevState => [...prevState, newGroup]))
              }}>Create Group</Button>
            </Box>


          </Grid>
          <Grid item xs={1} sm={1} md={2} lg={2} xl={2}></Grid>
        </Grid>
      }
    </>
  )
}

export default UserHome
