import { ChatItemType, MynahIcons, MynahUIDataModel, QuickActionCommandGroup, TabBarMainAction } from '@aws/mynah-ui'
import { disclaimerCard } from '../texts/disclaimer'
import { HistoryOptions } from '../chat'
import { EXPORT_CHAT_BUTTON_ID, VIEW_HISTORY_BUTTON_ID } from '../mynahUi'

export type DefaultTabData = MynahUIDataModel

export class TabFactory {
    public static generateUniqueId() {
        // from https://github.com/aws/mynah-ui/blob/a3799f47ca4b7c02850264e328539a40709a6858/src/helper/guid.ts#L6
        const firstPart: number = (Math.random() * 46656) | 0
        const secondPart: number = (Math.random() * 46656) | 0
        return `000${firstPart.toString(36)}`.slice(-3) + `000${secondPart.toString(36)}`.slice(-3)
    }

    constructor(
        private defaultTabData: DefaultTabData,
        private quickActionCommands?: QuickActionCommandGroup[],
        private historyOptions?: HistoryOptions
    ) {}

    public createTab(needWelcomeMessages: boolean, disclaimerCardActive: boolean): MynahUIDataModel {
        const tabData: MynahUIDataModel = {
            ...this.getDefaultTabData(),
            chatItems: needWelcomeMessages
                ? [
                      {
                          type: ChatItemType.ANSWER,
                          body: `Hi, I'm Amazon Q. I can answer your software development questions. 
                        Ask me to explain, debug, or optimize your code. 
                        You can enter \`/\` to see a list of quick actions.`,
                      },
                      {
                          type: ChatItemType.ANSWER,
                          followUp: this.getWelcomeBlock(),
                      },
                  ]
                : [],
            ...(disclaimerCardActive ? { promptInputStickyCard: disclaimerCard } : {}),
        }
        return tabData
    }

    public updateQuickActionCommands(quickActionCommands: QuickActionCommandGroup[]) {
        this.quickActionCommands = [...(this.quickActionCommands ?? []), ...quickActionCommands]
    }

    public updateHistoryOptions(options: HistoryOptions) {
        this.historyOptions = options
    }

    public getDefaultTabData(): DefaultTabData {
        return {
            ...this.defaultTabData,
            ...(this.quickActionCommands ? { quickActionCommands: this.quickActionCommands } : {}),
            tabBarButtons: this.getHistoryTabBarActions(),
        }
    }

    private getWelcomeBlock() {
        return {
            text: 'Try Examples:',
            options: [
                {
                    pillText: 'Explain selected code',
                    prompt: 'Explain selected code',
                    type: 'init-prompt',
                },
                {
                    pillText: 'How can Amazon Q help me?',
                    type: 'help',
                },
            ],
        }
    }

    private getHistoryTabBarActions(): TabBarMainAction[] {
        const tabBarActions = []

        if (this.historyOptions?.view) {
            tabBarActions.push({
                id: VIEW_HISTORY_BUTTON_ID,
                icon: MynahIcons.COMMENT,
                description: 'View chat history',
            })
        }

        if (this.historyOptions?.export) {
            tabBarActions.push({
                id: EXPORT_CHAT_BUTTON_ID,
                icon: MynahIcons.EXTERNAL,
                description: 'Export chat',
            })
        }

        return tabBarActions
    }
}
