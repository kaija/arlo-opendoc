export { auth as middleware } from "./auth.js";

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (Auth.js callback routes)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
