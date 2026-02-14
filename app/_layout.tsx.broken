import { Stack } from "expo-router";
import { NoosphereProvider } from "../context/NoosphereContext";
import "../global.css";

export default function RootLayout() {
  return (
    <NoosphereProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </NoosphereProvider>
  );
}