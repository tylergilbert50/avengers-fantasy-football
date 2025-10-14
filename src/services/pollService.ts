import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "../firebase";

export interface Votes {
  [position: string]: string | null;
}

export interface PollVote {
  userId: string;
  week: number;
  votes: Votes;
  timestamp: Timestamp;
}

const createVotesQuery = (...constraints: QueryConstraint[]) =>
  query(collection(db, "poll_votes"), ...constraints);

const mapDocToPollVote = (doc: any): PollVote => {
  const data = doc.data();
  return {
    userId: data.userId,
    week: data.week,
    votes: data.votes,
    timestamp: data.timestamp,
  };
};

const deleteMatchingDocs = async (q: ReturnType<typeof query>) => {
  const snapshot = await getDocs(q);
  await Promise.all(
    snapshot.docs.map((docSnapshot) =>
      deleteDoc(doc(db, "poll_votes", docSnapshot.id))
    )
  );
  return snapshot.docs.length;
};

export const submitVoteToFirebase = async (
  userId: string,
  week: number,
  votes: Votes
): Promise<boolean> => {
  const userWeekQuery = createVotesQuery(
    where("userId", "==", userId),
    where("week", "==", week)
  );

  await deleteMatchingDocs(userWeekQuery);

  await addDoc(collection(db, "poll_votes"), {
    userId,
    week,
    votes,
    timestamp: Timestamp.now(),
  });

  return true;
};

export const getVotesForWeek = async (week: number): Promise<PollVote[]> => {
  const weekQuery = createVotesQuery(where("week", "==", week));
  const snapshot = await getDocs(weekQuery);
  return snapshot.docs.map(mapDocToPollVote);
};

export const hasUserVoted = async (
  userId: string,
  week: number
): Promise<boolean> => {
  const userWeekQuery = createVotesQuery(
    where("userId", "==", userId),
    where("week", "==", week)
  );
  const snapshot = await getDocs(userWeekQuery);
  return !snapshot.empty;
};

export const clearAllVotesForWeek = async (week: number): Promise<boolean> => {
  const weekQuery = createVotesQuery(where("week", "==", week));
  await deleteMatchingDocs(weekQuery);
  return true;
};

export const clearUserVoteForWeek = async (
  userId: string,
  week: number
): Promise<boolean> => {
  const userWeekQuery = createVotesQuery(
    where("userId", "==", userId),
    where("week", "==", week)
  );
  await deleteMatchingDocs(userWeekQuery);
  return true;
};

export const listenToVotes = (
  week: number,
  callback: (votes: PollVote[]) => void
) => {
  const weekQuery = createVotesQuery(where("week", "==", week));
  return onSnapshot(weekQuery, (snapshot) =>
    callback(snapshot.docs.map(mapDocToPollVote))
  );
};
