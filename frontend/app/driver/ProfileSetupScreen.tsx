import Button from "../../components/Button";
import { router } from "expo-router";

export default function ProfileSetupScreen() {
  return (
    <>
      <Button 
        title=" My Feedbacks "
        onPress={() => router.push('/driver/MyFeedbacksScreen')}
        variant="primary"
        style={{ marginBottom: 12 }}
      />
    </>
  );
}
