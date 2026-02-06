import type { InstallationPolicy } from "../policies/installation-policy.js";
import type { PolicyId } from "../policies/policy-ids.js";

/**
 * Policy Registry
 * Manages reusable installation policies for different file operations
 * Provides registration and lookup for installation strategies
 */
export class PolicyRegistry {
	private policies: Map<PolicyId, InstallationPolicy> = new Map();

	/**
	 * Register an installation policy
	 */
	register(policy: InstallationPolicy): void {
		if (this.policies.has(policy.id)) {
			throw new Error(`Policy with id '${policy.id}' is already registered`);
		}

		this.policies.set(policy.id, policy);
	}

	/**
	 * Get a policy by ID
	 */
	get(policyId: PolicyId): InstallationPolicy | undefined {
		return this.policies.get(policyId);
	}

	/**
	 * Check if a policy is registered
	 */
	has(policyId: PolicyId): boolean {
		return this.policies.has(policyId);
	}

	/**
	 * Get all registered policy IDs
	 */
	getRegisteredPolicyIds(): PolicyId[] {
		return Array.from(this.policies.keys());
	}

	/**
	 * Get all registered policies
	 */
	getAllPolicies(): InstallationPolicy[] {
		return Array.from(this.policies.values());
	}

	/**
	 * Unregister a policy
	 */
	unregister(policyId: PolicyId): boolean {
		return this.policies.delete(policyId);
	}

	/**
	 * Clear all registered policies
	 */
	clear(): void {
		this.policies.clear();
	}

	/**
	 * Get policy count
	 */
	count(): number {
		return this.policies.size;
	}

	/**
	 * Validate that all required policies are registered
	 */
	validateRequiredPolicies(requiredPolicyIds: PolicyId[]): PolicyId[] {
		const missingPolicies: PolicyId[] = [];

		for (const policyId of requiredPolicyIds) {
			if (!this.has(policyId)) {
				missingPolicies.push(policyId);
			}
		}

		return missingPolicies;
	}
}
