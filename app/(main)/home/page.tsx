import { redirect } from "next/navigation";
import { HOME_PATH } from "@/lib/appRoutes";

export default function HomeAliasPage() {
  redirect(HOME_PATH);
}
