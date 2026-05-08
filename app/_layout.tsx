import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="student" 
        options={{ 
          title: 'Student Portal',
          headerBackTitle: 'Back'
        }} 
      />
      <Stack.Screen 
        name="guard" 
        options={{ 
          title: 'Guard Portal',
          headerBackTitle: 'Back'
        }} 
      />
      <Stack.Screen 
        name="admin" 
        options={{ 
          title: 'Admin Panel',
          headerBackTitle: 'Back'
        }} 
      />
      <Stack.Screen 
        name="activity" 
        options={{ 
          title: 'Activity Log',
          headerBackTitle: 'Back'
        }} 
      />
      <Stack.Screen 
        name="guest" 
        options={{ 
          title: 'Guest Mode',
          headerBackTitle: 'Back'
        }} 
      />
      <Stack.Screen 
        name="add-visitor" 
        options={{ 
          title: 'Add Visitor',
          headerBackTitle: 'Back'
        }} 
      />
      <Stack.Screen 
        name="guard-activity" 
        options={{ 
          title: 'Guard Activity',
          headerBackTitle: 'Back'
        }} 
      />
    </Stack>
  );
}