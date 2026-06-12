/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(auth)` | `/(auth)/login` | `/(auth)/signup` | `/(candidate)` | `/(candidate)/dashboard` | `/(candidate)/interview` | `/(candidate)/interview/create` | `/(candidate)/interview/report` | `/(candidate)/interview/session` | `/(candidate)/profile` | `/(candidate)/resume` | `/(candidate)/resume/upload` | `/(recruiter)` | `/(recruiter)/candidates` | `/(recruiter)/dashboard` | `/(recruiter)/interviews` | `/(recruiter)/profile` | `/_sitemap` | `/candidates` | `/dashboard` | `/interview` | `/interview/create` | `/interview/report` | `/interview/session` | `/interviews` | `/login` | `/profile` | `/resume` | `/resume/upload` | `/signup`;
      DynamicRoutes: `/(candidate)/interview/${Router.SingleRoutePart<T>}` | `/(recruiter)/cheating/${Router.SingleRoutePart<T>}` | `/cheating/${Router.SingleRoutePart<T>}` | `/interview/${Router.SingleRoutePart<T>}`;
      DynamicRouteTemplate: `/(candidate)/interview/[id]` | `/(recruiter)/cheating/[id]` | `/cheating/[id]` | `/interview/[id]`;
    }
  }
}
