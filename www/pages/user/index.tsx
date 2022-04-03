import type { NextPage } from "next"
import dynamic from "next/dynamic"
import LoginButton from "../../components/LoginButton"
import { useSession } from "next-auth/react"
import { Button, Divider, TextField } from "@mui/material"
import { useEffect, useState } from "react"
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

type GroupInfo = {
  email: string;
  role: string;
  active: boolean;
  groupId: string;
  name: string;
}

const UserHome: NextPage = () => {
  const { data } = useSession()
  let [newGroupName, setNewGroupName] = useState<string>("")
  let [groups, setGroups] = useState<GroupInfo[]>([])

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/recording_group`, { credentials: "include" }).then(r => r.json()).then(response => setGroups(response.groups))
  }, [data])

  return (
    <>
      <LoginButton />
      {
        data &&
        <div className={"user_home_container"}>
          <div className={"user_home_title"}>My Groups</div>

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
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell component="th" scope="row">
                      {g.name}
                    </TableCell>
                    <TableCell align="left">{g.role}</TableCell>
                    <TableCell align="left">{g.groupId}</TableCell>
                    <TableCell align="left">{g.active ? "yes" : "no"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>


          <Divider />
          <div className={"user_home_create_group"}>
            <TextField label="group name" onChange={(e) => setNewGroupName(e.target.value)} />
            <Button className={"user_home_create_button"} variant="contained" color={"success"} onClick={async () => {
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


        </div>
      }
    </>
  )
}

export default UserHome
