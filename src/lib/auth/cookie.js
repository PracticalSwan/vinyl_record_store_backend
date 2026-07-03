import {
  isSecureCookie,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "./config.js";

export function setSessionCookie(response, request, token, environment = process.env) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(request, environment),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}

export function clearSessionCookie(response, request, environment = process.env) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(request, environment),
    path: "/",
    maxAge: 0,
  });
  return response;
}
