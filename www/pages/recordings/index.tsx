import type { NextPage } from "next"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { PendingRecordWithUser, RecordingSummaryWithUser } from "@codereplay/types"
import TopBanner from "../../components/TopBanner"
import { getRandomColor, getProcessingStatusSeverityAndMessage, isMarkdown } from "../../utils/utils"
import { confirmFailure, getPendingRecordings, getRecordingsByKeywords, getRecordingsCount } from "../../api/api"
import { useRouter } from "next/router"
import { Array as ArrayType, String } from "runtypes"
import {
  Avatar,
  Card,
  CardActions,
  CardContent,
  CardHeader, Chip,
  Collapse,
  Grid,
  IconButton,
  IconButtonProps,
  styled, Tooltip, Typography
} from "@mui/material"
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import ForkLeftIcon from '@mui/icons-material/ForkLeft'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getReadableTimeString } from "../../utils/utils"
import Alert from "@mui/material/Alert"

/** Color map for tags, different for each refresh */
const colors = new Map()

/** return the color for a tag if it exists or generate a new one. */
const getTagColor = (normalizedTag: string): string => {
  if (colors.has(normalizedTag)) {
    return colors.get(normalizedTag)
  }
  while (true) {
    let newColor = getRandomColor()
    if (!colors.has(newColor)) {
      colors.set(normalizedTag, newColor)
      return newColor
    }
  }
}

/** Configure the description expand button of each Card. */
interface ExpandMoreProps extends IconButtonProps {
  expand: boolean;
}

const ExpandMore = styled((props: ExpandMoreProps) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? 'rotate(0deg)' : 'rotate(180deg)',
  marginLeft: 'auto',
  transition: theme.transitions.create('transform', {
    duration: theme.transitions.duration.shortest,
  }),
}));

/** Responsive container padding for main container */
const GridContainer = styled("div")(({ theme }) => ({
  width: "100%",
  [theme.breakpoints.down("sm")]: {
    padding: "4vh 4vw"
  },
  [theme.breakpoints.up("sm")]: {
    padding: "4vh 8vw"
  },
  [theme.breakpoints.up("sm")]: {
    padding: "4vh 12vw"
  }
}))

/** Responsive Grid containing 0-3 columns, if it contains a single column, use space around. */
const StyledGrid = styled(Grid)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    justifyContent: "space-around"
  },
  [theme.breakpoints.up("md")]: {
    justifyContent: "space-between"
  }
}))

/** Defines a single card for displaying one recording. */
const RecordingItem: React.FC<{recording: RecordingSummaryWithUser|PendingRecordWithUser}> = ({recording}) => {
  const [expanded, setExpanded] = React.useState(false);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  return <Grid item>
    <Card raised>
      <CardHeader
        avatar={
          <Avatar alt="U" src={recording.picture}/>
        }
        title={recording.title}
        subheader={getReadableTimeString(new Date(recording.fileRoot))}
      />
      <CardContent sx={{p: 0}}>
        {
          recording.tag.split(",").map((t: string, index: number) => {
            return <Chip key={index} label={t.trim()} sx={{backgroundColor: getTagColor(t.trim()), ml:"10px", mt:"5px"}}/>
          })
        }
      </CardContent>
      <CardActions disableSpacing>
        <IconButton aria-label="play recording" onClick={() => location.href=`/replay/${recording.fileRoot}`}>
          <PlayCircleIcon sx={{color: "green"}}/>
        </IconButton>
        <Tooltip title={"Fork Recording"}>
          <IconButton aria-label="fork recording" onClick={() => location.href=`/record/fork/${recording.fileRoot}`}>
            <ForkLeftIcon sx={{color: "orange"}}/>
          </IconButton>
        </Tooltip>
          <ExpandMore
            expand={expanded}
            onClick={handleExpandClick}
            aria-expanded={expanded}
            aria-label="show description"
          >
            <ExpandMoreIcon />
          </ExpandMore>
      </CardActions>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <CardContent>
          <Typography>
            {isMarkdown(recording.description) ? "Click play button to view description." : recording.description}
          </Typography>
        </CardContent>
      </Collapse>
    </Card>
  </Grid>
}

const Index: NextPage = () => {
  const router = useRouter()

  /** All the recordings displayed on the screen. */
  const [recordings, setRecordings] = useState<(RecordingSummaryWithUser|PendingRecordWithUser)[]>([])

  /** While there is no pagination, this is more for backend. */
  const [page, setPage] = useState(1)
  const pageRef = useRef(page)
  useEffect(() => {
    pageRef.current = page
  }, [page])

  /** Search keyword we get from url. */
  const [keyword, setKeyword] = useState("")
  const keywordRef = useRef(keyword)
  useEffect(() => {
    keywordRef.current = keyword
  }, [keyword])

  /** Adjust the column size responsively. */
  const [columnNum, setColumnNum] = useState(0)

  /** The total number of item we have */
  const [numRecordings, setNumRecordings] = useState(-1)
  const numRecordingsRef = useRef(numRecordings)
  useEffect(() => {
    numRecordingsRef.current = numRecordings
  }, [numRecordings])

  /** All the pending recordings, failed or processing */
  const [pendingRecordings, setPendingRecordings] = useState<PendingRecordWithUser[]>([])

  /** Whether there is currently a fetching in progress */
  const [isFetching, setIsFetching] = useState(false)
  const isFetchingRef = useRef(isFetching)
  useEffect(() => {
    isFetchingRef.current = isFetching
  }, [isFetching])

  const currentCountRef = useRef(0)
  useEffect(() => {
    currentCountRef.current = recordings.length
  }, [recordings])


  /**
   * Determine how many column we have based on window size.
   * @TODO - here is probably better way to manage the layout using media query.
   *       - The main problem for me is to keep things the same order so I decide to take this easy approach.
   */
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 900) {
        setColumnNum(1)
      } else if (window.innerWidth < 1200) {
        setColumnNum(2)
      } else {
        setColumnNum(3)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [])

  /**
   * A function that load the "next page data" when the user reaches the end of the page.
   * Additional logic is used to make sure to prevent race condition.
   * We use useRef instead of adding those value as dependency to make sure this is always the same function object.
   * @TODO Add rate limit.
   * */
  const mayFetchMoreData = useCallback(() => {
    if (isFetchingRef.current) {
      return
    }
    // wait for count data to load.
    const totalRecordingsCount = numRecordingsRef.current
    if (totalRecordingsCount == -1) {
      return
    }
    // if we already reach the end.
    const lastPage = Math.max(Math.ceil(totalRecordingsCount / 10.0), totalRecordingsCount / 10)
    if (totalRecordingsCount === currentCountRef.current || pageRef.current > lastPage) {
      window.removeEventListener('scroll', mayFetchMoreData)
      return
    }
    // wait for user to reach the end of the screen.
    const pageNotScrollable = window.innerHeight >= document.documentElement.offsetHeight
    const notScrolledToBottom = window.innerHeight + document.documentElement.scrollTop <= document.documentElement.offsetHeight * 0.9
    if (!pageNotScrollable && notScrolledToBottom) {
      return
    }
    setIsFetching(true)
    window.removeEventListener('scroll', mayFetchMoreData)
    getRecordingsByKeywords(keywordRef.current, pageRef.current).then(newRecordings => {
      setRecordings(prevState => [...prevState, ...newRecordings])
      setIsFetching(false)
      window.addEventListener('scroll', mayFetchMoreData)
    })
    setPage(prevState => prevState + 1)
  }, [])

  /** Monitor scrolling event, if reach the end, fetch new data */
  useEffect(() => {
    window.addEventListener('scroll', mayFetchMoreData);
    return () => window.removeEventListener('scroll', mayFetchMoreData);
  }, [mayFetchMoreData]);

  /**
   * when the current data does not fill the window, try to load, since there is no scroll possible.
   * Include isFetching as dependency to make sure this fire after the count load.
   * */
  useEffect(() => {
    if (window.innerHeight >= document.documentElement.offsetHeight && !isFetching) {
      mayFetchMoreData()
    }
  }, [mayFetchMoreData, isFetching])

  /**
   * Load list when the search keyword change - this should not happen
   * */
  useEffect(() => {
    if (!router.isReady) {
      return
    }
    const { keyword } = router.query
    let query = keyword
    if (!String.guard(keyword)) {
      query = ""
    }
    setKeyword(String.check(query))
    // this order is important to make things work, otherwise if the data might never load if there is no initial scroll bar.
    setIsFetching(true)
    getRecordingsCount(String.check(query)).then(count => {
      setNumRecordings(count)
      getRecordingsByKeywords(String.check(query), 1).then(recordingSummaries => {
        setRecordings(recordingSummaries)
      })
      setPage(2)
      setIsFetching(false)
    })
  }, [router.isReady, router.query])

  /** Try to fetch pending record, may trigger the poller (if there is any pending recordings) */
  useEffect(() => {
    const poller = setInterval(function tryFetchPendingRecordings() {
      getPendingRecordings().then(newPendingRecordings => {
        setPendingRecordings(prevPendingRecordings => {
          const oldFileRoots = new Set(prevPendingRecordings.map(v => v.fileRoot))
          const newFileRoots = new Set(newPendingRecordings.map(v => v.fileRoot))

          const userPausedNotification: number[] = []

          const mergedPendingRecordings = [...prevPendingRecordings, ...newPendingRecordings]
          const processedPendingRecordings = mergedPendingRecordings.map((v, index) => {
            if (userPausedNotification.includes(v.fileRoot) || v.processingStatus == "pauseNotification") {
              userPausedNotification.push(v.fileRoot)
              if (v.processingStatus == "pauseNotification") {
                return v
              }
              return null
            }
            const inOld = oldFileRoots.has(v.fileRoot)
            const inNew = newFileRoots.has(v.fileRoot)
            if (inOld && !inNew) {
              v.processingStatus = "success"
              setRecordings(prevState => [v, ...prevState])
            }
            // if it is processing -> processing or processing -> fail, remove the old entry
            if (inOld && inNew && v.processingStatus === "processing" && index < prevPendingRecordings.length) {
              return null
            }
            // if it is processing -> fail or fail -> fail, remove the old entry
            if (inOld && inNew && v.processingStatus === "failed" && index < prevPendingRecordings.length) {
              return null
            }
            return v
          }).filter(v => v !== null)
          if (newPendingRecordings.filter(v => v.processingStatus === "processing").length === 0) {
            clearInterval(poller)
          }
          return ArrayType(PendingRecordWithUser).check(processedPendingRecordings)
        })
      })
      return tryFetchPendingRecordings
    }(), 5000)
  }, [])

  return (
    <>
      <TopBanner/>
      <GridContainer sx={{ flexGrow: 1, mt:"120px"}}>
        {
          pendingRecordings.filter(v => v.processingStatus != "pauseNotification").map((record, index) => {
            const {severity, message} = getProcessingStatusSeverityAndMessage(record.processingStatus, record.title)
            return <Alert sx={{ mb: "1.5vh" }} key={index} severity={severity} onClose={() => {
              if (severity === "error") {
                confirmFailure(record.fileRoot)
              }
              setPendingRecordings(prevState => {
                return prevState.map(v => {
                  if (v.fileRoot == record.fileRoot) {
                    v.processingStatus = "pauseNotification"
                  }
                  return v
                })
              })
            }}>{message}</Alert>
          })
        }
        <StyledGrid sx={{mt: "3vh"}} container direction="row" alignItems="flex-start">
          {
            Array(columnNum).fill(0).map((_, columnIndex) => {
                return <Grid xs={12} sm={12} md={5.5} lg={3.5} xl={3.5} key={columnIndex} rowSpacing={3} container item direction="column">
                  {
                    recordings.map((recording, recordingIndex) => {
                      if (recordingIndex % columnNum == columnIndex) {
                        return <RecordingItem key={recordingIndex} recording={recording}/>
                      }
                      return null
                    })
                  }
                </Grid>
              }
            )
          }
        </StyledGrid>
      </GridContainer>
    </>
  )
}

export default Index