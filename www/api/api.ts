import {
  PendingRecordWithUser,
  RecordingGroup,
  RecordingSummaryWithUser
} from "@codereplay/types"
import { Array, Number as NumberType } from "runtypes"
import { Result, Submission } from "@cs124/playground-types"

/** Retrieve recordings using search keyword and the page number. */
export const getRecordingsByKeywords = async (keyWord: string, page: number): Promise<RecordingSummaryWithUser[]> => {
  /**
   * @TODO - This only support searching title.
   *       - I'm slightly concerned with using the same way to search description
   *       - regex is essentially a full-text search and might leads to performance issue.
   */
  const query = encodeURIComponent(`{"title": {"$regex" : "${keyWord.trim()}", "$options" : "i"}}`)
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}/recordings/search/${query}/${page}`, { credentials: "include" })
    .then((r) => r.json())
    .then((response) => {
      return Array(RecordingSummaryWithUser).check(response.recordings)
    })
}

export const getRecordingsByParent = async (parent: string, allowsFork: boolean, validGroup: string|null, page: number): Promise<RecordingSummaryWithUser[]> => {
  const query: {
    $or?: Object[];
    fileRoot?: number;
    forkedFrom?: number;
    userGroups?: string;
  } = {}

  if (!allowsFork) {
    query["fileRoot"] = Number(parent)
  } else {
    if (validGroup === "allForks") {
      query["forkedFrom"] = Number(parent)
    } else {
      query["$or"] = [
        {forkedFrom: Number(parent), userGroups: validGroup},{fileRoot: Number(parent)}
      ]
    }
  }


  return fetch(`${process.env.NEXT_PUBLIC_API_URL}/recordings/search/${encodeURIComponent(JSON.stringify(query))}/${page}`, { credentials: "include" })
    .then((r) => r.json())
    .then((response) => {
      return Array(RecordingSummaryWithUser).check(response.recordings)
    })
}

/** Retrieve count of filtered recordings. */
export const getRecordingsCount = async (keyWord: string): Promise<number> => {
  const query = encodeURIComponent(`{"title": {"$regex" : "${keyWord.trim()}", "$options" : "i"}}`)
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}/recordings/count/${query}`, { credentials: "include" })
    .then((r) => r.json())
    .then((response) => {
      return NumberType.check(response.count)
    })
}

/** Retrieve all pending recordings for a given user */
export const getPendingRecordings = (): Promise<PendingRecordWithUser[]> => {
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}/recordings/pending`, {
    method: "GET",
    credentials: "include"
  }).then(r => r.json()).then(response => Array(PendingRecordWithUser).check(response.pendingRecordings))
}

/** Confirm a failed recording */
export const confirmFailure = (fileRoot: number) => {
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/confirm/${fileRoot}`, {
    method: "POST",
    credentials: "include"
  }).then()
}

/** Attempt to update the user data. */
export const mayUpdateUserMetadata = () => {
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/user`, { method: "POST", credentials: "include" }).then()
}

/**
 * Try to join a group, return a promise of "success" or the error message.
 * @param groupId the group the user tries to join
 */
export const joinGroup = (groupId: string) => {
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}/join_group`, {
    method: "post",
    body: JSON.stringify({ groupId: groupId }),
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include"
  }).then(response => {
    if (response.ok) {
      return "success"
    } else {
      return response.text()
    }
  })
}

/** Get information of a specific recording, using fileRoot */
export const findRecording = (fileRoot: number) => {
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}/recordings/find/${fileRoot}`, {
    method: "GET",
    credentials: "include"
  }).then(r => r.json()).then(response => RecordingSummaryWithUser.check(response.recording))
}

/** Get trace of a recording in json format */
export const getSavedTrace = (fileRoot: number) => {
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}/downloads/${fileRoot}.json`).then((r) =>
    r.json()
  )
}

/** Get the recording groups the current user belongs to. */
export const getRecordingGroups = (): Promise<RecordingGroup[]> => {
  return fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/recording_group`,
    { credentials: "include" })
    .then(r => r.json())
    .then(response => Array(RecordingGroup).check(response.groups))
}

export const submitCodeToPlayground = (endpoint: string, submission: Submission): Promise<Result> => {
  return fetch(endpoint, {
    method: "post",
    body: JSON.stringify(submission),
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include"
  }).then(async (r) => r.json()).then(result => Result.check(result))
}

/** Create a recording group with given name */
export const createRecordingGroup = (name: string): Promise<RecordingGroup> => {
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}/recording_group`, {
    method: "post",
    body: JSON.stringify({ name: name }),
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include"
  }).then(r => r.json()).then(r => RecordingGroup.check(r.newGroup))
}

/** Update group active status */
export const updateGroupStatus = (id: string, status: boolean) => {
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/update_group/${id}/${status}`, {
    method: "post",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include"
  }).then()
}