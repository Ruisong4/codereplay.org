import type { NextPage } from "next"
import TopBanner from "../components/TopBanner"
import { Box, Button, Grid, styled, Typography } from "@mui/material"
import Image from "next/image"


const Page = styled(Box)(({ theme }) => ({
  width: "100%",
  height: "100vh",
  [theme.breakpoints.down("sm")]: {
    paddingTop: "10vh"
  },
  [theme.breakpoints.up("sm")]: {
    paddingTop: "20vh"
  },
  [theme.breakpoints.up("lg")]: {
    paddingTop: "25vh"
  }
}))

const PageContent = styled(Grid)(({ theme }) => ({
  margin: "0 auto",
  [theme.breakpoints.down("sm")]: {
    width: "90%"
  },
  [theme.breakpoints.up("sm")]: {
    width: "70%"
  },
  [theme.breakpoints.up("lg")]: {
    width: "50%"
  }
}))

const Home: NextPage = () => {

  return (
    <>
      <TopBanner/>
      <Page>
        <PageContent container spacing={2} alignItems="center" justifyContent="space-between">
          <Grid xs={12} sm={12} md={7} lg={7} xl={7} item>
            <Typography sx={{userSelect: "none"}} variant="h3">
              &lt;CodeReplay/&gt;
            </Typography>
            <Typography sx={{userSelect: "none", mt:"20px"}} variant="h6">
              Code replay allows you to create a coding example with voice over in most languages easily and share it with everyone.
            </Typography>
            <Button sx={{mt: "20px"}} onClick={() => location.href = "/record"} variant="contained">Create My Recording</Button>
          </Grid>
          <Grid xs={12} sm={12} md={3} lg={3} xl={3} item>
            <Image alt="" src={"/icon.png"} width="200px" height={"200px"}/>
          </Grid>
        </PageContent>
      </Page>
    </>
  )
}

export default Home
