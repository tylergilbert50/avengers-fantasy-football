Directory Breakdown
-------------------

/assets         : Holds static resources such as images and fonts.
  /images       : App icons, logos, illustrations, etc.
  /fonts        : Custom font files to be loaded into the app.

components/     : Contains reusable and shared UI components.
                  Example: Button.tsx, Card.tsx

screens/        : Individual screens or pages of the app.
                  Example: LoginScreen.tsx, homeScreenStyles.tsx

navigation/     : Handles screen navigation logic (e.g. stacks, tabs).
                  Uses react-navigation setup files.

context/        : React Contexts for managing global state like auth or theme.

styles/         : (Optional) Centralized style variables, themes, or mixins.

App.tsx         : The root of your app. Initializes navigation and global context.

Styling Breakdown
-----------------

Layout          : position, flex, flexDirection, justifyContent, alignItems, padding, margin, width, height
Appearance      : backgroundColor, borderRadius, shadow, opacity
Text            : fontSize, fontWeight, color, textAlign
Misc            : zIndex, overflow