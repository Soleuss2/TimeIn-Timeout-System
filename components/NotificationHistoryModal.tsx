import React from "react";
import {
  Modal,
  View,
  StyleSheet,
  SafeAreaView,
  Platform,
} from "react-native";
import { NotificationHistory } from "./NotificationHistory";

interface NotificationHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  userId?: string;
  guardId?: string;
  isGuard?: boolean;
  maxItems?: number;
}

export const NotificationHistoryModal: React.FC<
  NotificationHistoryModalProps
> = ({
  visible,
  onClose,
  userId,
  guardId,
  isGuard = false,
  maxItems = 50,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <NotificationHistory
          userId={userId}
          guardId={guardId}
          isGuard={isGuard}
          maxItems={maxItems}
          onClose={onClose}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
});
