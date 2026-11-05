import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { auth } from "./firebase.js";

const SUPABASE_URL = "https://hwefxyjfuqxmjdnppdly.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0I7CT2PTlXaDdh44jdH1wg_Rbo-oMpd";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    accessToken: async () => {
      const user = auth.currentUser;
      return user ? await user.getIdToken() : null;
    }
  }
);

console.log("Supabase client configured");
