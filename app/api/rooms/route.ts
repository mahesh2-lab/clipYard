// app/api/rooms/route.ts


import { NextResponse } from "next/server";
import { getFirebaseAdmin, mintRoomAuthToken } from "@/lib/firebase-admin";
import { ServerValue } from "firebase-admin/database";
import { createRoomId, isValidRoomId } from "@/lib/clipboard";
import { signRoomToken } from "@/lib/room-token";
import { encryptRoomText } from "@/lib/room-data";
import { isRoomExpired } from "@/lib/presence";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const requestedRoomId =
      typeof body.roomId === "string" ? body.roomId.trim().toLowerCase() : "";
    const roomId =
      requestedRoomId && isValidRoomId(requestedRoomId)
        ? requestedRoomId
        : createRoomId();
    const { database } = getFirebaseAdmin();
    const hostUid = crypto.randomUUID();

    const existing = await database.ref(`rooms/${roomId}/meta`).get();
    if (existing.exists()) {
      const existingMeta = existing.val();
      if (isRoomExpired(existingMeta?.createdAt)) {
        // Old room is older than 24hr, clean it up from Firebase
        await database.ref(`rooms/${roomId}`).remove().catch(() => undefined);
      } else {
        return NextResponse.json(
          { error: "Room already exists" },
          { status: 409 },
        );
      }
    }
    await database.ref(`rooms/${roomId}`).set({
      meta: {
        hostUid,
        status: "open",
        createdAt: ServerValue.TIMESTAMP,
        lastSeen: ServerValue.TIMESTAMP,
      },
      clip: { text: encryptRoomText(""), updatedAt: ServerValue.TIMESTAMP, updatedBy: hostUid },
      presence: {},
    });

    const [token, firebaseToken] = await Promise.all([
      signRoomToken({ roomId, role: "host", sid: hostUid }),
      mintRoomAuthToken(hostUid, roomId),
    ])

    return NextResponse.json({
      roomId,
      token,
      firebaseToken,
      role: "host",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Firebase is not configured",
      },
      { status: 503 },
    );
  }
}
