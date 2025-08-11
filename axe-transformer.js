/**
 * Theia IDE Accessibility Agent Integration Example
 * 
 * This example shows how to integrate the Axe transformer into your Theia IDE extension
 */

// Import the transformer (adjust path as needed)
import { AxeToTheiaTransformer, transformAxeJsonForTheia } from './axe-transformer';

/**
 * Accessibility Agent Class for Theia IDE
 */
export class AccessibilityAgent {
    
    /**
     * Process Axe DevTools JSON input
     * @param axeJsonInput - Raw JSON from Axe DevTools extension
     * @returns Promise with processed results
     */
    async processAxeResults(axeJsonInput: string | object): Promise<any> {
        try {
            console.log('Processing Axe results...');
            
            // Step 1: Transform Axe format to Theia format
            const transformedResults = AxeToTheiaTransformer.transform(axeJsonInput);
            
            // Step 2: Get summary for quick overview
            const summary = AxeToTheiaTransformer.getSummary(transformedResults);
            
            console.log(`Processed ${summary.totalIssues} accessibility issues`);
            console.log('Impact distribution:', summary.byImpact);
            
            // Step 3: Process the content array as expected by your agent
            const processedContent = await this.processContentArray(transformedResults.content);
            
            return {
                success: true,
                data: {
                    ...transformedResults,
                    processedContent,
                    summary
                }
            };
            
        } catch (error) {
            console.error('Accessibility Agent Error:', error.message);
            return {
                success: false,
                error: error.message,
                suggestion: 'Please verify the Axe DevTools JSON format and try again.'
            };
        }
    }
    
    /**
     * Process the content array (your existing agent logic goes here)
     * @param content - Array of accessibility issues in Theia format
     * @returns Processed content
     */
    private async processContentArray(content: any[]): Promise<any[]> {
        // This is where your existing Accessibility Agent logic would go
        // The content array now has the expected format with type and data fields
        
        return content.map(item => {
            // Example processing - customize based on your agent's needs
            return {
                ...item,
                processed: true,
                severity: this.calculateSeverity(item),
                recommendations: this.generateRecommendations(item)
            };
        });
    }
    
    /**
     * Calculate severity score for prioritization
     */
    private calculateSeverity(item: any): number {
        const impactScores = {
            'critical': 4,
            'serious': 3,
            'moderate': 2,
            'minor': 1
        };
        
        return impactScores[item.data.impact] || 0;
    }
    
    /**
     * Generate recommendations based on issue type
     */
    private generateRecommendations(item: any): string[] {
        const recommendations: string[] = [];
        
        switch (item.data.id) {
            case 'button-name':
                recommendations.push('Add aria-label or visible text to the button');
                recommendations.push('Consider using title attribute for additional context');
                break;
            case 'link-in-text-block':
                recommendations.push('Add underline or other visual distinction beyond color');
                recommendations.push('Ensure sufficient color contrast (minimum 3:1)');
                break;
            case 'meta-viewport':
                recommendations.push('Remove user-scalable=no from viewport meta tag');
                recommendations.push('Allow users to zoom up to 200%');
                break;
            default:
                recommendations.push('Review the help URL for detailed guidance');
        }
        
        return recommendations;
    }
    
    /**
     * Filter issues by priority for focused remediation
     */
    filterByPriority(transformedResults: any, priority: 'high' | 'medium' | 'low'): any[] {
        const priorityMap = {
            'high': ['critical', 'serious'],
            'medium': ['moderate'],
            'low': ['minor']
        };
        
        return AxeToTheiaTransformer.filterContent(transformedResults, {
            impact: priorityMap[priority]
        });
    }
    
    /**
     * Generate accessibility report
     */
    generateReport(transformedResults: any): string {
        const summary = AxeToTheiaTransformer.getSummary(transformedResults);
        
        let report = `# Accessibility Report\n\n`;
        report += `**URL:** ${transformedResults.metadata.url}\n`;
        report += `**Test Date:** ${transformedResults.metadata.timestamp}\n`;
        report += `**Standard:** ${transformedResults.metadata.standard}\n\n`;
        
        report += `## Summary\n`;
        report += `- **Total Issues:** ${summary.totalIssues}\n`;
        report += `- **Critical:** ${summary.byImpact.critical || 0}\n`;
        report += `- **Serious:** ${summary.byImpact.serious || 0}\n`;
        report += `- **Moderate:** ${summary.byImpact.moderate || 0}\n`;
        report += `- **Minor:** ${summary.byImpact.minor || 0}\n\n`;
        
        report += `## Failed Rules\n`;
        Object.entries(summary.byRule).forEach(([rule, count]) => {
            report += `- **${rule}:** ${count} issues\n`;
        });
        
        return report;
    }
}

/**
 * Example usage in your Theia extension
 */
export class TheiaAccessibilityExtension {
    
    private accessibilityAgent: AccessibilityAgent;
    
    constructor() {
        this.accessibilityAgent = new AccessibilityAgent();
    }
    
    /**
     * Handle Axe DevTools JSON input from user
     */
    async handleAxeInput(axeJsonString: string) {
        try {
            // Parse the JSON to validate it first
            const axeData = JSON.parse(axeJsonString);
            
            // Process with the accessibility agent
            const result = await this.accessibilityAgent.processAxeResults(axeData);
            
            if (result.success) {
                // Display results in Theia UI
                this.displayResults(result.data);
                
                // Generate and save report
                const report = this.accessibilityAgent.generateReport(result.data);
                await this.saveReport(report);
                
                return {
                    message: `Successfully processed ${result.data.summary.totalIssues} accessibility issues`,
                    data: result.data
                };
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            // Handle the original error you were seeing
            if (error.message.includes('content array')) {
                return {
                    error: 'Format mismatch detected. The JSON has been automatically transformed.',
                    transformedData: await this.accessibilityAgent.processAxeResults(axeJsonString)
                };
            }
            
            throw error;
        }
    }
    
    /**
     * Display results in Theia UI
     */
    private displayResults(data: any) {
        // Implementation depends on your Theia UI setup
        console.log('Displaying results in Theia UI...');
        console.log(`Found ${data.summary.totalIssues} issues`);
        
        // Group issues by severity for better UX
        const criticalIssues = data.content.filter(item => item.data.impact === 'critical');
        const seriousIssues = data.content.filter(item => item.data.impact === 'serious');
        
        if (criticalIssues.length > 0) {
            console.warn(`🚨 ${criticalIssues.length} CRITICAL issues need immediate attention`);
        }
        
        if (seriousIssues.length > 0) {
            console.warn(`⚠️  ${seriousIssues.length} SERIOUS issues found`);
        }
    }
    
    /**
     * Save accessibility report to workspace
     */
    private async saveReport(report: string): Promise<void> {
        // Save report to workspace - implementation depends on Theia file system API
        console.log('Saving accessibility report...');
        // await this.fileService.writeFile(uri, report);
    }
}

/**
 * Usage example with your actual JSON data:
 */

// Example 1: Direct transformation
const yourAxeJson = `{
  "url": "https://www.wavemakeronline.com/run-48q56srcx7/ent1268c6be87b1/FinanceAI_master/#/Dashboard",
  "extensionVersion": "4.113.4",
  "axeVersion": "4.10.3",
  "allIssues": [
    // ... your issues array
  ]
}`;

// Transform for Theia
const theiaFormat = transformAxeJsonForTheia(yourAxeJson);

// Example 2: Full integration
async function runExample() {
    const extension = new TheiaAccessibilityExtension();
    const result = await extension.handleAxeInput(yourAxeJson);
    console.log('Processing result:', result);
}

// Export for Theia extension registration
export { TheiaAccessibilityExtension as default };