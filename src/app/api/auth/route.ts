import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { password } = await request.json();

  // Compare against the password stored in environment variable
  const correctPassword = process.env.FAMILY_PASSWORD;

  if (!correctPassword) {
    console.error("FAMILY_PASSWORD environment variable is not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  if (password === correctPassword) {
    const response = NextResponse.json({ success: true });

    // Set a cookie that lasts 30 days
    response.cookies.set("family-auth", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  }

  return NextResponse.json({ error: "Invalid password" }, { status: 401 });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("family-auth");
  return response;
}
