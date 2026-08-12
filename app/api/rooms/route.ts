// app/api/rooms/route.ts


import { NextResponse } from "next/server";
import { getFirebaseAdmin, mintRoomAuthToken } from "@/lib/firebase-admin";
import { ServerValue } from "firebase-admin/database";
import { createRoomId, isValidRoomId } from "@/lib/clipboard";
import { signRoomToken } from "@/lib/room-token";
import { encryptRoomText } from "@/lib/room-data";

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
    if (existing.exists())
      return NextResponse.json(
        { error: "Room already exists" },
        { status: 409 },
      );
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;
    await database.ref(`rooms/${roomId}`).set({
      meta: {
        hostUid,
        status: "open",
        createdAt: ServerValue.TIMESTAMP,
        expiresAt,
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
