import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      {/* This hides the default header because our Chat App has its own custom header */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}